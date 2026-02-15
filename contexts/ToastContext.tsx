import React, { createContext, ReactNode, useContext, useState } from "react";
import Toast, { ToastType } from "../components/Toast";

interface ToastConfig {
  message: string;
  type?: ToastType;
  duration?: number;
  position?: "top" | "bottom";
}

interface ToastContextType {
  showToast: (config: ToastConfig) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toastConfig, setToastConfig] = useState<ToastConfig | null>(null);
  const [visible, setVisible] = useState(false);

  const showToast = (config: ToastConfig) => {
    setToastConfig(config);
    setVisible(true);
  };

  const hideToast = () => {
    setVisible(false);
    setTimeout(() => {
      setToastConfig(null);
    }, 300); // Wait for animation to complete
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toastConfig && (
        <Toast
          visible={visible}
          message={toastConfig.message}
          type={toastConfig.type}
          duration={toastConfig.duration}
          position={toastConfig.position}
          onHide={hideToast}
        />
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};
