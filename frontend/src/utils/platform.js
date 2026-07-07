import { Capacitor } from "@capacitor/core";

export const isInstalledApp = () => {
  return Capacitor.isNativePlatform();
};

export const isWebsite = () => {
  return !Capacitor.isNativePlatform();
};