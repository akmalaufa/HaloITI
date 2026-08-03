"use client";

import React, { useState } from "react";
import { Calculator, GraduationCap, CalendarClock } from "lucide-react";
// Nanti diimport komponen spesifik:
import ProdiTab from "./pricing/ProdiTab";
import PeriodeTab from "./pricing/PeriodeTab";
import BiayaTab from "./pricing/BiayaTab";

type TabState = "biaya" | "prodi" | "periode";

export default function PricingClient() {
  const [activeTab, setActiveTab] = useState<TabState>("biaya");

  const renderContent = () => {
    switch (activeTab) {
      case "prodi":
        return <ProdiTab />;
      case "periode":
        return <PeriodeTab />;
      case "biaya":
      default:
        return <BiayaTab />;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 3 Tabs Navigation */}
      <div className="flex flex-col sm:flex-row gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("biaya")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "biaya"
              ? "bg-[var(--color-brand)] text-white shadow-lg"
              : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white border border-white/5"
          }`}
        >
          <Calculator className="h-4 w-4" />
          Biaya Studi & UKT
        </button>

        <button
          onClick={() => setActiveTab("prodi")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "prodi"
              ? "bg-[var(--color-brand)] text-white shadow-lg"
              : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white border border-white/5"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Program Studi
        </button>

        <button
          onClick={() => setActiveTab("periode")}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "periode"
              ? "bg-[var(--color-brand)] text-white shadow-lg"
              : "bg-[#1a1a1a] text-gray-400 hover:bg-[#2a2a2a] hover:text-white border border-white/5"
          }`}
        >
          <CalendarClock className="h-4 w-4" />
          Periode Pendaftaran
        </button>
      </div>

      {/* Tab Content Rendering */}
      <div className="w-full">
        {renderContent()}
      </div>
    </div>
  );
}
