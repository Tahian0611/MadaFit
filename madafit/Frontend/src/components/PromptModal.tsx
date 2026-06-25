import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/madafit";

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value?: any) => void;
  title: string;
  message: string;
  type: "confirm" | "prompt";
  defaultValue?: string | number;
  inputType?: string;
  confirmText?: string;
  confirmColor?: string;
  promoCode?: string;
}

export default function PromptModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type,
  defaultValue = "",
  inputType = "text",
  confirmText = "Confirmer",
  confirmColor = "bg-primary",
  promoCode
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-card w-full h-full sm:h-auto sm:max-w-sm rounded-none sm:rounded-2xl border shadow-2xl p-6 flex flex-col justify-center sm:justify-start space-y-6 sm:animate-in sm:zoom-in-95 duration-200 overflow-y-auto"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>

        {type === "prompt" && (
          <div className="space-y-4">
            <div className="relative">
              <input
                autoFocus
                type={inputType}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-center text-lg font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirm(value);
                  if (e.key === "Escape") onClose();
                }}
              />
              {inputType === "number" && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground pointer-events-none">
                  MGA
                </div>
              )}
            </div>
            
            {/* Petit rappel du format monétaire si c'est un montant */}
            {!isNaN(Number(value)) && Number(value) > 0 && inputType === "number" && (
                <div className="space-y-1 animate-in fade-in">
                  <p className="text-center text-[10px] font-bold text-primary uppercase">
                    Total à valider : {formatCurrency(Number(value))}
                  </p>
                  {promoCode && (
                    <p className="text-center text-[9px] font-medium text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full w-fit mx-auto border border-green-500/20">
                      Réduction "{promoCode}" incluse
                    </p>
                  )}
                </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button 
            onClick={onClose}
            className="py-3 px-4 bg-muted text-foreground rounded-xl font-bold text-sm transition-all hover:bg-muted/80 active:scale-95"
          >
            Annuler
          </button>
          <button 
            onClick={() => onConfirm(value)}
            className={`py-3 px-4 ${confirmColor} text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
