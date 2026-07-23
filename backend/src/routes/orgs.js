'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const Org     = require('../models/Org');
const { toMspId, toDomain, toFolderName, provisionOrg } = require('../fabric/provisioner');
const { assignCaPort, assignPeerPort } = require('../fabric/portManager');

// ── POST /orgs/register ───────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, type, whatTheyMake, address, contact, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !type || !whatTheyMake || !address || !contact || !email || !password || !confirmPassword) {
      return res.status(400).json({
        error: 'All fields required: name, type, whatTheyMake, address, contact, email, password, confirmPassword',
      });
    }
    const { street, city, state, country } = address || {};
    if (!street || !String(street).trim() || !city || !String(city).trim() || !state || !String(state).trim() || !country || !String(country).trim()) {
      return res.status(400).json({
        error: 'Address must include street, city, state, and country',
      });
    }

    // Validate password
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }
    if (!['manufacturer', 'supplier'].includes(type)) {
      return res.status(400).json({ error: 'type must be "manufacturer" or "supplier"' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }
    const existingEmail = await Org.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ error: 'Email address is already registered' });
    }

    // Produce a baseline safe alphanumeric string for Fabric paths
    const cleanBaseName = name.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    if (cleanBaseName.length < 3) {
      return res.status(400).json({
        error: 'Organization name must contain at least 3 letters or digits.',
      });
    }

    // Default slug matches the cleaned name.
    let slug = cleanBaseName;

    // Ensure slug uniqueness for repeated business names.
    while (await Org.findOne({ slug })) {
      const randomSuffix = crypto.randomBytes(2).toString('hex'); // e.g., "8f3a"
      slug = `${cleanBaseName}-${randomSuffix}`;
    }

    // Allocate unique numeric port numbers asynchronously
    const caPort = await assignCaPort();
    const peerPort = await assignPeerPort();
    const ccPort = peerPort + 1;
    const peerName = 'peer0';

    // Downstream generation parameters are completely unique to this specific slug
    const mspId      = toMspId(slug);      
    const domain     = toDomain(slug);     
    const folderName = toFolderName(slug); 

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Save metadata structure into database
    const org = new Org({
      name: name.trim(),
      slug,
      type,
      whatTheyMake,
      address: {
        street: String(street).trim(),
        city: String(city).trim(),
        state: String(state).trim(),
        country: String(country).trim(),
      },
      contact,
      email: normalizedEmail,
      passwordHash,
      caPort,
      peerPort,
      ccPort,
      peerName,
      mspId,
      domain,
      folderName,
      fabricStatus: 'registering',
    });

    await org.save();

    // Provision the org using a plain JS object so downstream code gets exact fields.
    const orgPayload = org.toObject();
    provisionOrg(orgPayload)
      .then(async () => {
        org.fabricStatus = 'active';
        await org.save();
        console.log(`[Fabric] Org ${slug} successfully active.`);
      })
      .catch(async (err) => {
        console.error(`[Fabric] Provisioning failed for ${slug}:`, err);
        org.fabricStatus = 'failed';
        await org.save();
      });

    res.status(202).json({
      message: 'Registration initiated successfully.',
      orgId: org._id,
      name: org.name,
      email: org.email,
      mspId: org.mspId,
      slug: org.slug,
      fabricStatus: org.fabricStatus,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs ─────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { type, search } = req.query;
    const filter = {};

    if (req.query.status) filter.fabricStatus = req.query.status;
    if (type) filter.type = type;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const orgs = await Org.find(filter).select('-__v').sort({ createdAt: -1 });
    res.json(orgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs/by-msp/:mspId ───────────────────────────────────────────────────
router.get('/by-msp/:mspId', async (req, res) => {
  try {
    const org = await Org.findOne({ mspId: req.params.mspId }).select('-__v');
    if (!org) return res.status(404).json({ error: 'Org not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /orgs/login ───────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Identifier and password are required' });
    }

    const org = await Org.findOne({
      $or: [{ email: identifier.toLowerCase() }, { slug: identifier }]
    });

    if (!org) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, org.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      id: org._id,
      orgId: org._id,
      name: org.name,
      email: org.email,
      mspId: org.mspId,
      slug: org.slug,
      type: org.type,
      fabricStatus: org.fabricStatus,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /orgs/:id ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const org = await Org.findById(req.params.id).select('-__v');
    if (!org) return res.status(404).json({ error: 'Org not found' });
    res.json(org);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;