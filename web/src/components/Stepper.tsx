"use client";

import React from "react";

interface StepperProps {
  currentStep: number;
  onSelectStep: (step: number) => void;
}

const steps = [
  { step: 1, name: "Credentials" },
  { step: 2, name: "Family Members" },
  { step: 3, name: "Preferences" },
  { step: 4, name: "Ranking Bot" },
  { step: 5, name: "Deploy & Finish" },
];

export function Stepper({ currentStep, onSelectStep }: StepperProps) {
  return (
    <nav className="stepper" aria-label="Setup steps">
      {steps.map((s, index) => {
        const isActive = currentStep === s.step;
        const isCompleted = currentStep > s.step;
        return (
          <React.Fragment key={s.step}>
            <div
              className={`step-item ${isActive ? "active" : ""} ${isCompleted ? "completed" : ""}`}
              onClick={() => onSelectStep(s.step)}
            >
              <div className="step-circle">{isCompleted ? "✓" : s.step}</div>
              <span className="step-name">{s.name}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`step-line ${currentStep > s.step ? "filled" : ""}`} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
