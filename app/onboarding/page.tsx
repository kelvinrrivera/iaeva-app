'use client';

/**
 * Multi-Nicho Onboarding Flow
 *
 * 6-step wizard for new shop setup:
 * 1. Shop Type Selection (Barbería, Salón de Belleza, Centro de Uñas, Híbrido)
 * 2. Shop Information (name, phone, address, logo)
 * 3. Services Setup (pre-configured by niche)
 * 4. Team Setup (add staff members)
 * 5. WhatsApp Setup (connect WhatsApp Business API)
 * 6. Plan Selection (FREE, PROFESSIONAL, ENTERPRISE)
 *
 * Features:
 * - Progress indicator with visual progress bar
 * - State persistence (localStorage) for resume capability
 * - Step validation before proceeding
 * - Skip capability for optional steps
 * - Dynamic terminology based on shop type
 */

import React, { useState, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Check, Settings2 } from 'lucide-react';
import { NicheSelector } from '@/components/onboarding/NicheSelector';
import { AddressAutocomplete } from '@/components/ui/AddressAutocomplete';
import PricingPlans from '@/components/ui/PricingPlans';
import type { ShopType } from '@prisma/client';
import FacebookSDKScript from '@/components/whatsapp/FacebookSDKScript';
import { EmbeddedSignupLauncher } from '@/components/whatsapp/EmbeddedSignupLauncher';
import {
  getCatalogForShopType,
  getCategoriesForShopType,
  getDefaultServices,
  DURATION_OPTIONS,
  type CatalogService,
} from '@/lib/constants/service-catalog';

interface OnboardingData {
  shopType?: ShopType;
  shopName?: string;
  shopAddress?: string;
  shopLatitude?: number;
  shopLongitude?: number;
  shopPlaceId?: string;
  services?: Service[];
  whatsappPhone?: string;
  whatsappVerified?: boolean;
  whatsappAccessToken?: string;
  whatsappWabaId?: string;
  whatsappPhoneNumberId?: string;
  plan?: 'SOLO' | 'TEAM' | 'BUSINESS';
}

interface Service {
  name: string;
  type?: string;
  price: number;
  duration: number;
}

const STEPS = [
  { id: 1, title: 'Tipo de Negocio', description: 'Selecciona tu nicho' },
  { id: 2, title: 'Informacion del Negocio', description: 'Cuentanos sobre tu negocio' },
  { id: 3, title: 'Servicios', description: 'Elige tus servicios' },
  { id: 4, title: 'WhatsApp', description: 'Conecta tu WhatsApp (opcional)' },
  { id: 5, title: 'Plan', description: 'Elige tu plan' },
];

/** Convert catalog item to Service for onboarding data */
function catalogToService(item: CatalogService): Service {
  return { name: item.name, type: item.serviceType, price: item.price, duration: item.duration };
}

/**
 * Wrapper with Suspense boundary — required by Next.js for any component
 * that uses useSearchParams() and is statically rendered.
 */
export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">Cargando...</div>}>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load saved data from localStorage, or pre-select from URL ?type=
  useEffect(() => {
    const savedData = localStorage.getItem('onboarding_data');
    const savedStep = localStorage.getItem('onboarding_step');

    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setData(parsedData);

      // If we have shopType but no services, initialize defaults from catalog
      if (parsedData.shopType && !parsedData.services) {
        const defaults = getDefaultServices(parsedData.shopType).map(catalogToService);
        setData((prev) => ({ ...prev, services: defaults }));
      }
    } else {
      // Fresh start: check ?type= in URL to pre-select shop type and skip step 1
      const urlType = searchParams.get('type');
      if (urlType === 'BARBERSHOP' || urlType === 'BEAUTY_SALON' || urlType === 'HYBRID') {
        const defaults = getDefaultServices(urlType).map(catalogToService);
        setData({ shopType: urlType as ShopType, services: defaults });
        setCurrentStep(2); // jump straight to "Shop Info"
      }
    }
    if (savedStep) {
      setCurrentStep(parseInt(savedStep, 10));
    }
  }, [searchParams]);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('onboarding_data', JSON.stringify(data));
    localStorage.setItem('onboarding_step', currentStep.toString());
  }, [data, currentStep]);

  const updateData = (updates: Partial<OnboardingData>) => {
    setData((prev) => {
      const newData = { ...prev, ...updates };

      // Initialize default services from catalog when shopType is selected
      if (updates.shopType && !prev.services) {
        newData.services = getDefaultServices(updates.shopType).map(catalogToService);
      }

      return newData;
    });

    // Clear errors for updated fields
    const updatedErrors = { ...errors };
    Object.keys(updates).forEach((key) => {
      delete updatedErrors[key];
    });
    setErrors(updatedErrors);
  };

  const validateCurrentStep = (): boolean => {
    const newErrors: Record<string, string> = {};

    switch (currentStep) {
      case 1:
        if (!data.shopType) {
          newErrors.shopType = 'Selecciona un tipo de negocio';
        }
        break;

      case 2:
        if (!data.shopName || data.shopName.trim().length < 2) {
          newErrors.shopName = 'El nombre debe tener al menos 2 caracteres';
        }
        if (!data.shopAddress || data.shopAddress.trim().length < 5) {
          newErrors.shopAddress = 'La dirección es requerida';
        }
        break;

      case 3:
        if (!data.services || data.services.length === 0) {
          newErrors.services = 'Añade al menos un servicio';
        }
        break;

      case 4:
        if (data.whatsappPhone && !data.whatsappVerified) {
          newErrors.whatsapp = 'Verifica tu número de WhatsApp';
        }
        break;

      case 5:
        if (!data.plan) {
          newErrors.plan = 'Selecciona un plan';
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }

    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleComplete = async () => {
    if (!validateCurrentStep()) {
      return;
    }

    setIsLoading(true);

    try {
      // Create shop via API
      const response = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const msg = errorData.detail ? `${errorData.error}: ${errorData.detail}` : errorData.error;
        throw new Error(msg || 'Error al completar el onboarding');
      }

      // Clear localStorage
      localStorage.removeItem('onboarding_data');
      localStorage.removeItem('onboarding_step');

      // If paid plan selected at onboarding, redirect to Stripe Checkout.
      // Otherwise the shop starts on its 14-day trial.
      if (data.plan) {
        const checkoutRes = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ plan: data.plan }),
        });
        const checkoutData = await checkoutRes.json();
        if (checkoutRes.ok && checkoutData.checkoutUrl) {
          window.location.href = checkoutData.checkoutUrl;
          return;
        }
        // Checkout failed — show error instead of silently redirecting to dashboard
        console.error('Stripe checkout failed:', checkoutRes.status, checkoutData);
        throw new Error(checkoutData.error || 'Error al crear la sesión de pago. Puedes actualizar tu plan desde Ajustes.');
      }

      // Free plan or Stripe fallback → go to dashboard
      router.push('/dashboard?onboarding=complete');
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      setErrors({
        submit: error.message || 'Error al completar el onboarding. Por favor intenta de nuevo.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const canGoBack = currentStep > 1;
  const canGoNext = currentStep < STEPS.length;
  const isLastStep = currentStep === STEPS.length;
  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4" style={{ backgroundImage: 'linear-gradient(to bottom, #f0f4ff 0%, #f9fafb 40%)' }}>
      <FacebookSDKScript />
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo-icon.svg" alt="DomiCita" width={32} height={32} />
            <span className="font-black text-charcoal text-base tracking-tight">DomiCita</span>
          </div>
          <span className="text-xs font-medium text-gray-400">
            Paso {currentStep} de {STEPS.length}
          </span>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          {/* Step dots */}
          <div className="flex items-center gap-2 mb-4">
            {STEPS.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all duration-300 shrink-0 ${index + 1 < currentStep
                  ? 'bg-primary text-white'
                  : index + 1 === currentStep
                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                    : 'bg-gray-100 text-gray-400'
                  }`}>
                  {index + 1 < currentStep ? '✓' : step.id}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 rounded transition-all duration-500 ${index + 1 < currentStep ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-8">
            {/* Step Header */}
            <div className="mb-7 pb-6 border-b border-gray-100">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/5 border border-primary/10 mb-3">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  Paso {currentStep} de {STEPS.length} — {STEPS[currentStep - 1].description}
                </span>
              </div>
              <h2 className="text-xl font-black text-charcoal">
                {STEPS[currentStep - 1].title}
              </h2>
            </div>

            {errors.submit && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <p className="text-sm font-bold text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Step 1: Shop Type Selection */}
            {currentStep === 1 && (
              <Step1ShopType
                selected={data.shopType}
                onSelect={(shopType: ShopType) => updateData({ shopType })}
                error={errors.shopType}
              />
            )}

            {/* Step 2: Shop Information */}
            {currentStep === 2 && (
              <Step2ShopInfo
                data={data}
                onUpdate={updateData}
                errors={errors}
              />
            )}

            {/* Step 3: Services Setup */}
            {currentStep === 3 && (
              <Step3Services
                shopType={data.shopType}
                services={data.services || []}
                onUpdate={(services: Service[]) => updateData({ services })}
                error={errors.services}
              />
            )}

            {/* Step 4: WhatsApp Setup */}
            {currentStep === 4 && (
              <Step5WhatsApp
                data={data}
                onUpdate={updateData}
                error={errors.whatsapp}
              />
            )}

            {/* Step 5: Plan Selection */}
            {currentStep === 5 && (
              <Step6Plan
                selectedPlan={data.plan}
                onSelect={(plan: 'SOLO' | 'TEAM' | 'BUSINESS') => updateData({ plan })}
                error={errors.plan}
              />
            )}
          </div>

          {/* Navigation Footer */}
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={!canGoBack || isLoading}
              className={`
                px-5 py-2.5 rounded-lg font-semibold transition-all
                ${canGoBack && !isLoading
                  ? 'bg-white border-2 border-gray-200 text-gray-700 hover:border-gray-300'
                  : 'bg-transparent text-gray-400 cursor-not-allowed'
                }
                flex items-center gap-2
              `}
            >
              <ChevronLeft className="h-4 w-4" />
              Atrás
            </button>

            {isLastStep ? (
              <button
                onClick={handleComplete}
                disabled={isLoading}
                className={`
                  px-6 py-2.5 rounded-lg font-semibold text-white
                  bg-gradient-to-r from-primary to-primary hover:from-primary-dark hover:to-primary
                  disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed
                  transition-all shadow-lg shadow-primary/20
                  flex items-center gap-2
                `}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Completar Configuración'
                )}
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {currentStep === 4 && (
                  <button
                    onClick={handleNext}
                    className="px-4 py-2.5 text-sm text-gray-400 hover:text-gray-600 font-medium transition-colors"
                  >
                    Saltar
                  </button>
                )}
                <button
                  onClick={handleNext}
                  disabled={isLoading}
                  className={`
                    px-6 py-2.5 rounded-lg font-semibold text-white
                    bg-gradient-to-r from-primary to-primary hover:from-primary-dark hover:to-primary
                    disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed
                    transition-all shadow-lg shadow-primary/20
                    flex items-center gap-2
                  `}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Skip onboarding link */}
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-gray-600 hover:text-charcoal font-medium transition-colors"
          >
            Completar más tarde →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==================== STEP COMPONENTS ==================== */

function Step1ShopType({ selected, onSelect, error }: any) {
  return (
    <div>
      <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <p className="text-sm text-charcoal">
          Selecciona el tipo de negocio que mejor describe lo que haces. Esto nos ayuda a personalizar tu experiencia.
        </p>
      </div>

      <NicheSelector
        selectedValue={selected}
        onSelect={onSelect}
        size="lg"
        layout="grid"
      />

      {error && (
        <p className="mt-6 p-3 bg-red-50 border border-red-200 rounded-lg text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Step2ShopInfo({ data, onUpdate, errors }: any) {
  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 text-sm font-bold text-charcoal mb-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">1</span>
          Nombre del Negocio *
        </label>
        <input
          type="text"
          value={data.shopName || ''}
          onChange={(e) => onUpdate({ shopName: e.target.value })}
          placeholder="Ej: Barbería Santiago"
          className={`
            w-full px-4 py-3 rounded-xl border-2 text-charcoal font-semibold
            ${errors.shopName ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-primary'}
            focus:ring-0 transition-all
          `}
        />
        {errors.shopName && (
          <p className="mt-1 text-sm font-semibold text-red-600">{errors.shopName}</p>
        )}
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm font-bold text-charcoal mb-2">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs">2</span>
          Dirección *
        </label>
        <AddressAutocomplete
          value={data.shopAddress || ''}
          onChange={(address) => onUpdate({ shopAddress: address })}
          onPlaceSelect={(place) => onUpdate({
            shopAddress: place.address,
            shopLatitude: place.latitude,
            shopLongitude: place.longitude,
            shopPlaceId: place.placeId,
          })}
          placeholder="Ej: Calle El Conde 55, Zona Colonial, Santo Domingo"
          error={errors.shopAddress}
        />
      </div>

    </div>
  );
}

function Step3Services({ shopType, services, onUpdate, error }: any) {
  const [showAdjust, setShowAdjust] = React.useState(false);
  const [showCustom, setShowCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState('');
  const [customPrice, setCustomPrice] = React.useState(300);
  const [customDuration, setCustomDuration] = React.useState(30);

  const catalog = getCatalogForShopType(shopType || 'BARBERSHOP');
  const categories = getCategoriesForShopType(shopType || 'BARBERSHOP');
  const selectedNames = new Set((services as Service[]).map((s: Service) => s.name));

  const toggleService = (item: CatalogService) => {
    if (selectedNames.has(item.name)) {
      onUpdate((services as Service[]).filter((s: Service) => s.name !== item.name));
    } else {
      onUpdate([...services, catalogToService(item)]);
    }
  };

  const handleUpdateService = (index: number, field: string, value: any) => {
    const updated = [...services];
    updated[index] = { ...updated[index], [field]: value };
    onUpdate(updated);
  };

  // Custom services = those not in the catalog
  const catalogNames = new Set(catalog.map((c: CatalogService) => c.name));
  const customServices = (services as Service[]).filter((s: Service) => !catalogNames.has(s.name));

  const handleAddCustom = () => {
    if (!customName.trim()) return;
    onUpdate([...services, { name: customName.trim(), type: 'HAIRCUT', price: customPrice, duration: customDuration }]);
    setCustomName('');
    setCustomPrice(300);
    setCustomDuration(30);
    setShowCustom(false);
  };

  const handleRemoveCustom = (name: string) => {
    onUpdate((services as Service[]).filter((s: Service) => s.name !== name));
  };

  return (
    <div>
      <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-900 font-medium">
          Selecciona los servicios que ofreces. Puedes ajustar precios y duraciones despues.
        </p>
      </div>

      {/* Catalog by category */}
      <div className="space-y-5 mb-5">
        {categories.map((cat) => (
          <div key={cat}>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">{cat}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {catalog.filter(s => s.category === cat).map((item) => {
                const isSelected = selectedNames.has(item.name);
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => toggleService(item)}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary border-primary' : 'border-gray-300'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-charcoal text-sm leading-tight">{item.name}</p>
                      <p className="text-xs text-gray-500">RD${item.price} · {item.duration} min</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Custom service */}
      {showCustom ? (
        <div className="mb-4 p-4 bg-primary/5 rounded-xl border-2 border-primary/20 space-y-3">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Nombre del servicio"
            className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm"
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Precio (RD$)</label>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Duracion</label>
              <select
                value={customDuration}
                onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm"
              >
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddCustom} disabled={!customName.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">Anadir</button>
            <button onClick={() => setShowCustom(false)} className="px-4 py-2 bg-white text-gray-600 border border-gray-200 rounded-lg text-sm font-semibold">Cancelar</button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCustom(true)}
          className="w-full mb-4 px-4 py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary/40 hover:text-primary text-sm font-semibold transition-all"
        >
          + Servicio personalizado
        </button>
      )}

      {/* Custom services list */}
      {customServices.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-1">Personalizados</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {customServices.map((s: Service) => (
              <div
                key={s.name}
                className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary bg-primary/5"
              >
                <div className="w-5 h-5 rounded border-2 bg-primary border-primary flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-charcoal text-sm leading-tight">{s.name}</p>
                  <p className="text-xs text-gray-500">RD${s.price} · {s.duration} min</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCustom(s.name)}
                  className="text-gray-400 hover:text-red-500 transition-colors shrink-0"
                  title="Eliminar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adjust prices section */}
      {services.length > 0 && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={() => setShowAdjust(!showAdjust)}
            className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-primary transition-colors mb-3"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Ajustar precios y duraciones ({services.length} seleccionados)
          </button>

          {showAdjust && (
            <div className="space-y-2">
              {(services as Service[]).map((service: Service, index: number) => (
                <div key={service.name + index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="flex-1 text-sm font-semibold text-charcoal truncate min-w-0">{service.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400">RD$</span>
                      <input
                        type="number"
                        value={service.price}
                        onChange={(e) => handleUpdateService(index, 'price', parseInt(e.target.value) || 0)}
                        className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-0 text-sm text-center font-semibold"
                      />
                    </div>
                    <select
                      value={service.duration}
                      onChange={(e) => handleUpdateService(index, 'duration', parseInt(e.target.value))}
                      className="w-24 px-2 py-1.5 rounded-lg border border-gray-200 focus:border-primary focus:ring-0 text-sm font-semibold"
                    >
                      {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function Step5WhatsApp({ data, onUpdate, error }: any) {
  const [mode, setMode] = React.useState<'coexistence' | 'cloud_api' | null>(null);
  const [connectError, setConnectError] = React.useState('');
  const [connecting, setConnecting] = React.useState(false);

  const handleSuccess = async (result: { code: string; wabaId: string; phoneNumberId: string; featureType: 'coexistence' | 'cloud_api' }) => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result),
      });
      const json = await res.json();
      if (!res.ok) {
        setConnectError(json.error || 'Error al conectar');
        setConnecting(false);
        return;
      }
      onUpdate({
        whatsappVerified: true,
        whatsappPhone: json.phoneNumber,
        whatsappAccessToken: result.code,
        whatsappWabaId: result.wabaId,
        whatsappPhoneNumberId: result.phoneNumberId,
        whatsappReady: json.ready,
        whatsappSyncing: json.syncing,
      });
    } catch (e: any) {
      setConnectError(e.message || 'Error de conexión');
    } finally {
      setConnecting(false);
    }
  };

  const handleReset = () => {
    setConnectError('');
    setMode(null);
    onUpdate({
      whatsappPhone: '',
      whatsappVerified: false,
      whatsappReady: false,
      whatsappSyncing: false,
      whatsappAccessToken: undefined,
      whatsappWabaId: undefined,
      whatsappPhoneNumberId: undefined,
    });
  };

  const isConnected = data.whatsappVerified;

  return (
    <div className="space-y-5">
      <FacebookSDKScript />

      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-900 font-semibold mb-0.5">Conecta tu WhatsApp Business</p>
        <p className="text-sm text-emerald-800">
          Activa el chatbot y las citas automáticas conectando el número de WhatsApp de tu negocio.
        </p>
      </div>

      {isConnected ? (
        <div className="p-5 bg-green-50 border-2 border-green-300 rounded-xl space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-bold text-green-800 text-sm">WhatsApp conectado</p>
              <p className="text-xs text-green-700">{data.whatsappPhone}</p>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-green-600 hover:text-green-800 font-semibold"
            >
              Cambiar
            </button>
          </div>
          {data.whatsappSyncing && (
            <p className="text-xs text-emerald-700 bg-emerald-100/60 rounded-lg px-3 py-2">
              ⏳ Tu WhatsApp se está sincronizando con Meta. Tarda 4-6 horas la primera vez. Te avisaremos cuando esté listo — mientras tanto puedes seguir configurando todo lo demás.
            </p>
          )}
          {data.whatsappReady && (
            <p className="text-xs text-emerald-700 bg-emerald-100/60 rounded-lg px-3 py-2">
              ✅ ¡Listo! Tu bot ya puede responder mensajes.
            </p>
          )}
        </div>
      ) : (
        <>
          {(error || connectError) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm font-semibold text-red-600">{error || connectError}</p>
            </div>
          )}

          {mode === null && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-charcoal">¿Cómo quieres usar WhatsApp con DomiCita?</p>

              <button
                type="button"
                onClick={() => setMode('coexistence')}
                className="w-full p-4 border-2 border-emerald-200 rounded-xl text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition"
              >
                <p className="text-sm font-bold text-charcoal mb-1">Mantener WhatsApp Business en mi teléfono</p>
                <p className="text-xs text-gray-600">
                  Sigues recibiendo mensajes en tu teléfono Y el bot responde automáticamente. Cuando contestes desde tu teléfono, el bot se calla. Recomendado.
                </p>
                <p className="text-xs text-amber-700 mt-1.5">⏱️ Tarda 4-6 horas en activarse la primera vez.</p>
              </button>

              <button
                type="button"
                onClick={() => setMode('cloud_api')}
                className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-gray-400 hover:bg-gray-50 transition"
              >
                <p className="text-sm font-bold text-charcoal mb-1">Solo con DomiCita</p>
                <p className="text-xs text-gray-600">
                  El bot maneja TODO. Pierdes el acceso al WhatsApp Business app del teléfono para este número.
                </p>
                <p className="text-xs text-emerald-700 mt-1.5">⚡ Activación inmediata.</p>
              </button>
            </div>
          )}

          {mode !== null && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ← Cambiar opción
              </button>
              <EmbeddedSignupLauncher
                featureType={mode}
                onSuccess={handleSuccess}
                onError={(msg) => setConnectError(msg)}
                disabled={connecting}
                buttonClassName="w-full inline-flex items-center justify-center px-5 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              />
            </div>
          )}

          <p className="text-xs text-gray-400 text-center">
            Este paso es opcional — puedes configurarlo después desde Ajustes.
          </p>
        </>
      )}
    </div>
  );
}

function Step6Plan({ selectedPlan, onSelect, error }: any) {
  return (
    <div>
      <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-800 font-semibold">
          Pruébalo 14 días gratis · Sin tarjeta · Cancela cuando quieras
        </p>
        <p className="text-xs text-emerald-700 mt-1">
          Elige un plan ahora. No te cobramos hasta que termine la prueba.
        </p>
      </div>
      <PricingPlans
        mode="select"
        selectedPlan={selectedPlan}
        onSelect={onSelect}
        showDop={true}
        error={error}
        hideBillingToggle={true}
      />
    </div>
  );
}
