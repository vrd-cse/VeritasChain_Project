'use strict';

const mongoose = require('mongoose');

const OrgSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    // unique: true <-- Removed so multiple orgs can have the same display name
  },
  slug: {
    type: String,
    required: true,
    unique: true, // <-- Keeps the cryptographic network details totally isolated
    trim: true,
    lowercase: true
  },
  type: {
    type: String,
    enum: ['manufacturer', 'supplier'],
    required: true,
  },
  whatTheyMake: {
    type: String,
    required: true,
  },
  address: {
    street: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  contact: {
    type: String,
    required: true,
  },
  caPort: Number,
  peerPort: Number,
  ccPort: Number,
  peerName: {
    type: String,
    default: 'peer0',
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
  },
  passwordHash: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  fabricStatus: {
    type: String,
    enum: ['registering', 'active', 'failed'], // <-- FIX: Changed to lowercase values to match routes
    default: 'registering',
  },
  mspId: String,
  domain: String,
  folderName: String,
}, { timestamps: true });

module.exports = mongoose.model('Org', OrgSchema);