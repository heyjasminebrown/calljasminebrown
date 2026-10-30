import { WarmNotificationSettings } from "@/components/settings/WarmNotificationSettings";
import { PushNotifications } from "@/components/settings/PushNotifications";
import type { WarmNotificationSettings as WarmSettings } from "@/types/database";

export function NotificationsCard({ warmSettings, vapidPublicKey }: { warmSettings: WarmSettings | null; vapidPublicKey: string | undefined }) {
  return (
    <div className="rounded-2xl border border-[#ebe9e7] bg-white p-[18px]">
      <p className="text-base font-semibold text-neutral-900">Notifications</p>
      <div className="mt-3">
        <WarmNotificationSettings settings={warmSettings} />
      </div>
      <div className="mt-3.5 border-t border-neutral-100 pt-3.5">
        <PushNotifications vapidPublicKey={vapidPublicKey} />
      </div>
    </div>
  );
}
