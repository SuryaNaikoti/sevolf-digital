"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { CurrencyCode } from "@/lib/currency";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (code: CurrencyCode) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>("INR");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("sevolf_currency");
      if (stored && (stored === "INR" || stored === "USD" || stored === "GBP" || stored === "EUR")) {
        setCurrencyState(stored as CurrencyCode);
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  const setCurrency = (code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      localStorage.setItem("sevolf_currency", code);
    } catch {
      // Ignore
    }
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within CurrencyProvider");
  }
  return context;
}
