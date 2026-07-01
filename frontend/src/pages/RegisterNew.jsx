import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { CenteredLayout } from '../components/Layout';
import {
  GlassmorphicCard,
  GlassmorphicInput,
  GlassmorphicButton,
  GlassmorphicSelect,
  GlassmorphicTextarea,
} from '../components/ui/GlassmorphicComponents';
import { useToast } from '../hooks/useNotification';
import { authService } from '../services/api';

const REGISTRATION_STEPS = [
  { id: 1, title: 'Organization Info', description: 'Basic organization details' },
  { id: 2, title: 'Contact Info', description: 'Email and contact details' },
  { id: 3, title: 'Security', description: 'Set up your password' },
  { id: 4, title: 'Review', description: 'Confirm your information' },
];

export function RegisterPage() {
  const navigate = useNavigate();
  const { error, success } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    whatTheyMake: '',
    address: '',
    contact: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Organization name is required';
      if (!formData.type) newErrors.type = 'Organization type is required';
      if (!formData.whatTheyMake.trim()) newErrors.whatTheyMake = 'Please describe what you make/provide';
      if (!formData.address.trim()) newErrors.address = 'Address is required';
    }

    if (step === 2) {
      if (!formData.contact.trim()) newErrors.contact = 'Contact number is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email address';
      }
    }

    if (step === 3) {
      if (!formData.password) newErrors.password = 'Password is required';
      if (formData.password.length < 8) newErrors.password = 'Password must be at least 8 characters';
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, REGISTRATION_STEPS.length));
    }
  };

  const handlePrevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setLoading(true);

    try {
      const response = await authService.register(formData);
      success('Registration successful! Your organization is being set up.');
      localStorage.setItem('pendingOrgId', response.data.orgId);
      navigate('/org-setup-progress', {
        state: { orgId: response.data.orgId, ...response.data },
      });
    } catch (err) {
      error(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Organization Name *
              </label>
              <GlassmorphicInput
                type="text"
                placeholder="e.g., Acme Manufacturing"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                error={!!errors.name}
                errorMessage={errors.name}
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Organization Type *
              </label>
              <GlassmorphicSelect
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                options={[
                  { value: 'manufacturer', label: 'Manufacturer' },
                  { value: 'supplier', label: 'Supplier' },
                ]}
                error={!!errors.type}
                errorMessage={errors.type}
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                What do you make/provide? *
              </label>
              <GlassmorphicTextarea
                placeholder="Describe your products/services..."
                value={formData.whatTheyMake}
                onChange={(e) => handleInputChange('whatTheyMake', e.target.value)}
                error={!!errors.whatTheyMake}
                errorMessage={errors.whatTheyMake}
                rows={3}
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Registered Office Address *
              </label>
              <GlassmorphicInput
                type="text"
                placeholder="e.g. 123 Business Avenue, Bengaluru, Karnataka 560001"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                error={!!errors.address}
                errorMessage={errors.address}
              />
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Contact Number *
              </label>
              <GlassmorphicInput
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formData.contact}
                onChange={(e) => handleInputChange('contact', e.target.value)}
                error={!!errors.contact}
                errorMessage={errors.contact}
              />
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Email Address *
              </label>
              <GlassmorphicInput
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                error={!!errors.email}
                errorMessage={errors.email}
              />
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Password *
              </label>
              <GlassmorphicInput
                type="password"
                placeholder="Create a strong password"
                value={formData.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                error={!!errors.password}
                errorMessage={errors.password}
              />
              <p className="text-white/50 text-xs mt-2">
                Minimum 8 characters recommended
              </p>
            </div>

            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Confirm Password *
              </label>
              <GlassmorphicInput
                type="password"
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                error={!!errors.confirmPassword}
                errorMessage={errors.confirmPassword}
              />
            </div>
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <ReviewField label="Organization Name" value={formData.name} />
              <ReviewField label="Type" value={formData.type} />
              <ReviewField label="Description" value={formData.whatTheyMake} />
              <ReviewField label="Registered Office Address" value={formData.address} />
              <ReviewField label="Contact" value={formData.contact} />
              <ReviewField label="Email" value={formData.email} />
            </div>

            <div className="bg-green-500/10 border border-green-400/30 rounded-lg p-3 mt-4">
              <p className="text-green-200 text-sm">
                <Check className="w-4 h-4 inline mr-2" />
                All information is correct. Click Register to proceed.
              </p>
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const isLastStep = currentStep === REGISTRATION_STEPS.length;
  const isFirstStep = currentStep === 1;

  return (
    <CenteredLayout>
      <GlassmorphicCard className="elevated">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-2">
            {REGISTRATION_STEPS[currentStep - 1].title}
          </h2>
          <p className="text-white/70 text-sm">
            {REGISTRATION_STEPS[currentStep - 1].description}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-between mb-8">
          {REGISTRATION_STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <motion.div
                animate={{
                  backgroundColor:
                    index < currentStep - 1
                      ? 'rgb(34, 197, 94)'
                      : index === currentStep - 1
                        ? 'rgb(59, 130, 246)'
                        : 'rgba(255, 255, 255, 0.1)',
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
              >
                {index < currentStep - 1 ? (
                  <Check className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-white font-semibold">{step.id}</span>
                )}
              </motion.div>
              {index < REGISTRATION_STEPS.length - 1 && (
                <div
                  className={`h-1 flex-1 mx-1 rounded-full ${
                    index < currentStep - 1
                      ? 'bg-green-500'
                      : 'bg-white/20'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {renderStepContent()}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="mt-8 flex gap-4">
          <GlassmorphicButton
            onClick={handlePrevStep}
            disabled={isFirstStep || loading}
            variant="secondary"
            size="md"
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4 inline mr-2" />
            Back
          </GlassmorphicButton>

          <GlassmorphicButton
            onClick={isLastStep ? handleSubmit : handleNextStep}
            disabled={loading}
            loading={loading}
            size="md"
            className="flex-1"
          >
            {isLastStep ? 'Register' : (
              <>
                Next
                <ChevronRight className="w-4 h-4 inline ml-2" />
              </>
            )}
          </GlassmorphicButton>
        </div>
      </GlassmorphicCard>
    </CenteredLayout>
  );
}

function ReviewField({ label, value }) {
  return (
    <div className="p-3 bg-white/5 border border-white/10 rounded-lg">
      <p className="text-white/70 text-xs uppercase mb-1">{label}</p>
      <p className="text-white text-sm break-words">{value}</p>
    </div>
  );
}

