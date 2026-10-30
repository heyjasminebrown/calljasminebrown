"use client";

// Opens a call through Quo's mobile app via its documented deep link, so
// calls go out from the owner's business number and log through Quo
// automatically instead of her personal dialer. Deep linking is
// mobile-app-only per Quo's docs - on desktop, or if the app isn't
// installed, nothing intercepts the openphone:// scheme and the page
// just sits there, so this falls back to a plain tel: link if the tab
// hasn't been backgrounded (a sign a native app took over) within ~1.2s.
//
// On desktop the openphone:// scheme is never going to be handled (it's
// mobile-only), so trying it first just wastes 1.2s doing nothing every
// single call - go straight to tel: instead. tel: only actually opens Quo
// if the Quo desktop app is installed AND set as this computer's default
// calling app (an OS-level setting, not something a web page can turn on)
// - see support.openphone.com "make OpenPhone the default calling app".
// Without that, tel: still does nothing on most desktops; that's an OS
// configuration step, not a bug here.
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

export function openQuoCall(phone: string) {
  if (!isMobile()) {
    window.location.href = `tel:${phone}`;
    return;
  }

  const quoUrl = `openphone://dial?number=${encodeURIComponent(phone)}&action=call`;
  let handedOff = false;

  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = quoUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!handedOff) window.location.href = `tel:${phone}`;
  }, 1200);
}

// Same idea for texting - so a "Text" click also goes out from her
// business number and logs through Quo instead of opening her personal
// Messages app. Unlike calling, whether OpenPhone Desktop registers this
// scheme for composing a text at all is NOT confirmed (their docs only
// document the mobile call deep link) - so unlike openQuoCall this is
// tried on desktop too, not skipped. Worst case it does nothing for
// ~1.2s and falls through to a plain sms: link, exactly today's existing
// behavior - it can only help, never make things worse. If it turns out
// OpenPhone Desktop doesn't handle this, the real fix is the same one
// calls need on desktop: setting OpenPhone as the OS-level default
// handler for sms: links (an OS setting, not something this page can
// turn on) - see support.openphone.com's "make OpenPhone the default
// calling app" for the equivalent call-side instructions.
export function openQuoText(phone: string) {
  const quoUrl = `openphone://text?number=${encodeURIComponent(phone)}`;
  let handedOff = false;

  const onVisibilityChange = () => {
    if (document.hidden) handedOff = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  window.location.href = quoUrl;

  setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!handedOff) window.location.href = `sms:${phone}`;
  }, 1200);
}
