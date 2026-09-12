"use client";

import React, { useState } from "react";

interface StepPreferencesProps {
  messageLanguage: "EN" | "PT";
  onChangeMessageLanguage: (lang: "EN" | "PT") => void;
  storeCountryCode: string;
  onChangeStoreCountryCode: (code: string) => void;
}

const COMMON_COUNTRIES = [
  { code: "br", label: "🇧🇷 Brazil (BRL - R$)" },
  { code: "us", label: "🇺🇸 United States (USD - $)" },
  { code: "gb", label: "🇬🇧 United Kingdom (GBP - £)" },
  { code: "de", label: "🇩🇪 Germany / Eurozone (EUR - €)" },
  { code: "ca", label: "🇨🇦 Canada (CAD - $)" },
  { code: "au", label: "🇦🇺 Australia (AUD - $)" },
  { code: "jp", label: "🇯🇵 Japan (JPY - ¥)" },
  { code: "custom", label: "🌐 Other 2-letter country code..." },
];

export function StepPreferences({
  messageLanguage,
  onChangeMessageLanguage,
  storeCountryCode,
  onChangeStoreCountryCode,
}: StepPreferencesProps) {
  const isPreset = COMMON_COUNTRIES.some((c) => c.code === storeCountryCode);
  const [selectVal, setSelectVal] = useState(isPreset ? storeCountryCode : "custom");
  const [customVal, setCustomVal] = useState(isPreset ? "" : storeCountryCode);

  const handleSelectChange = (val: string) => {
    setSelectVal(val);
    if (val !== "custom") {
      onChangeStoreCountryCode(val);
    } else if (customVal) {
      onChangeStoreCountryCode(customVal.toLowerCase());
    }
  };

  const handleCustomChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z]/g, "").slice(0, 2).toLowerCase();
    setCustomVal(cleaned);
    onChangeStoreCountryCode(cleaned || "us");
  };

  return (
    <section>
      <div className="step-title-area">
        <h2>Notification & Store Preferences</h2>
        <p>Customize the announcement language and regional Steam store used for pricing calculation.</p>
      </div>

      {/* Language Selector */}
      <div className="form-group">
        <label className="field-label">Discord Message Language</label>
        <p className="field-desc">Choose the language for Discord game announcements and purchase logs.</p>
        <div className="radio-card-grid">
          <div
            className={`radio-card ${messageLanguage === "EN" ? "selected" : ""}`}
            onClick={() => onChangeMessageLanguage("EN")}
          >
            <span className="radio-flag">🇺🇸</span>
            <div>
              <div className="radio-label-title">English</div>
              <div className="radio-label-sample">&quot;Alice bought [Game] for $19.99&quot;</div>
            </div>
          </div>

          <div
            className={`radio-card ${messageLanguage === "PT" ? "selected" : ""}`}
            onClick={() => onChangeMessageLanguage("PT")}
          >
            <span className="radio-flag">🇧🇷</span>
            <div>
              <div className="radio-label-title">Português</div>
              <div className="radio-label-sample">&quot;Alice comprou [Jogo] por R$ 59,99&quot;</div>
            </div>
          </div>
        </div>
      </div>

      {/* Country Code */}
      <div className="form-group" style={{ marginTop: "36px" }}>
        <label htmlFor="store-country-select" className="field-label">Steam Store Regional Country</label>
        <p className="field-desc">
          Used to query game prices in your local currency.
        </p>
        <div className="input-row">
          <select
            id="store-country-select"
            value={selectVal}
            onChange={(e) => handleSelectChange(e.target.value)}
          >
            {COMMON_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>

          {selectVal === "custom" && (
            <div className="input-wrapper" style={{ maxWidth: "160px" }}>
              <input
                type="text"
                placeholder="e.g. mx, fr, es"
                value={customVal}
                onChange={(e) => handleCustomChange(e.target.value)}
                maxLength={2}
                style={{ textTransform: "lowercase", textAlign: "center" }}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
