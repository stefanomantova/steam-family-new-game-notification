"use client";

import React from "react";

interface ToastProps {
  toasts: Array<{ id: number; message: string }>;
}

export function ToastContainer({ toasts }: ToastProps) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
