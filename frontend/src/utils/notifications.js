import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

const API_URL = "https://soundwave-music.onrender.com";

export const initPushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications only run inside the installed mobile app.");
    return;
  }

  try {
    let permissionStatus = await PushNotifications.checkPermissions();

    if (permissionStatus.receive !== "granted") {
      permissionStatus = await PushNotifications.requestPermissions();
    }

    if (permissionStatus.receive !== "granted") {
      console.log("Notification permission not granted.");
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener("registration", async (token) => {
      console.log("Push token:", token.value);

      await fetch(`${API_URL}/api/notifications/register-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token: token.value,
          platform: "android",
          appId: "com.eric.soundwave",
        }),
      });
    });

    PushNotifications.addListener("registrationError", (error) => {
      console.error("Push registration error:", error);
    });

    PushNotifications.addListener("pushNotificationReceived", (notification) => {
      console.log("Notification received:", notification);
    });

    PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (notification) => {
        const url = notification.notification?.data?.url;

        if (url) {
          window.location.href = url;
        }
      }
    );
  } catch (error) {
    console.error("Failed to initialize notifications:", error);
  }
};