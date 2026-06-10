"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Status } from "@/hooks/use-profile-manager";

interface StatusBannerProps {
  status: Status;
  message: string;
  details: string | string[] | null;
}

export const StatusBanner = React.memo(function StatusBanner({ status, message, details }: StatusBannerProps) {
  if (status === "idle" || !message) return null;

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg text-sm border animate-in fade-in slide-in-from-top-1 duration-200 ${
      status === "loading" ? "bg-primary/5 border-primary/15 text-primary"
      : status === "success" ? "bg-success/10 border-success/20 text-success"
      : "bg-destructive/5 border-destructive/20 text-destructive"
    }`}>
      <div className="flex items-center gap-3 font-medium">
        {status === "loading" && <Loader2 size={15} className="animate-spin shrink-0" />}
        {status === "success" && <CheckCircle2 size={15} className="shrink-0" />}
        {status === "error" && <AlertCircle size={15} className="shrink-0" />}
        <span>{message}</span>
      </div>
      {status === "error" && details && (
        <div className="pl-6 text-xs text-destructive/80 leading-relaxed border-t border-destructive/10 pt-1.5 mt-0.5 animate-in fade-in duration-300">
          {Array.isArray(details) ? (
            <ul className="list-disc pl-4 flex flex-col gap-1">
              {details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          ) : (
            <p>{details}</p>
          )}
        </div>
      )}
    </div>
  );
});
