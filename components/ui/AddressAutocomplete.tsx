'use client';

/**
 * AddressAutocomplete
 *
 * Input with Google Places autocomplete via server-side proxy.
 * - Biased to Dominican Republic
 * - Returns full address + coordinates on selection
 * - Falls back to plain text input if API unavailable
 */

import React, { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

export interface PlaceResult {
  address: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  error?: string;
  label?: string;
  required?: boolean;
}

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = 'Busca la dirección del negocio...',
  className = '',
  inputClassName = '',
  error,
  label,
  required,
}: AddressAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = async (input: string) => {
    if (input.trim().length < 3) {
      setPredictions([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}`);
      const data = await res.json();
      setPredictions(data.predictions || []);
      setIsOpen((data.predictions || []).length > 0);
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);
    setSelectedPlace(null); // clear selection if user edits manually

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPredictions(val), 350);
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    setIsOpen(false);
    setPredictions([]);
    onChange(prediction.description);
    setLoading(true);

    try {
      const res = await fetch(`/api/places/details?placeId=${prediction.placeId}`);
      const data = await res.json();
      if (data.address) {
        const place: PlaceResult = {
          address: data.address,
          latitude: data.latitude,
          longitude: data.longitude,
          placeId: data.placeId,
        };
        setSelectedPlace(place);
        onChange(data.address);
        onPlaceSelect?.(place);
      }
    } catch {
      // keep the typed description as fallback
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    onChange('');
    setSelectedPlace(null);
    setPredictions([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-bold text-charcoal mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={`relative flex items-center ${error ? 'ring-2 ring-red-300 rounded-xl' : ''}`}>
        <MapPin className="absolute left-4 h-4 w-4 text-gray-400 pointer-events-none shrink-0 z-10" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={`
            w-full pl-10 pr-10 py-3 rounded-xl border-2 text-sm
            ${error ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-primary'}
            focus:ring-0 focus:outline-none transition-all
            ${selectedPlace ? 'text-charcoal font-semibold' : 'text-gray-700'}
            ${inputClassName}
          `}
        />

        <div className="absolute right-3 flex items-center gap-1">
          {loading && <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />}
          {value && !loading && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar dirección"
              className="p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Verified location badge */}
      {selectedPlace && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="text-xs text-emerald-700 font-semibold">Ubicación verificada en Google Maps</span>
          <a
            href={`https://www.google.com/maps/place/?q=place_id:${selectedPlace.placeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline font-semibold ml-auto"
          >
            Ver mapa
          </a>
        </div>
      )}

      {error && (
        <p className="mt-1 text-sm font-semibold text-red-600">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {predictions.map((p) => (
            <button
              key={p.placeId}
              type="button"
              onMouseDown={(e) => e.preventDefault()} // prevent blur before click
              onClick={() => handleSelectPrediction(p)}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-0"
            >
              <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-charcoal leading-tight">{p.mainText}</p>
                <p className="text-xs text-gray-400 mt-0.5">{p.secondaryText}</p>
              </div>
            </button>
          ))}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
            <p className="text-[10px] text-gray-400 text-right">Powered by Google</p>
          </div>
        </div>
      )}
    </div>
  );
}
