# Garmin Connect IQ app

The app implements the thin device client described in `PLAN.md`: it bootstraps a
pairing request, displays the six-digit code in the sync result, polls for
approval, stores the bearer token in `Application.Storage`, and reconciles the
audio feed with cached native audio content.

The checked-in build target is `fr170m` (Forerunner 170 Music).

The web side of pairing is available at `/pair`. A first sync starts pairing;
after the code is approved there, run sync again to complete token exchange.
