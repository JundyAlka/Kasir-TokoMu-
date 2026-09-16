import * as React from "react";

// Safe polyfill for React 19 server environments where @react-pdf/renderer
// accesses internal React reconciler properties (__CLIENT_INTERNALS__.S or __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.S).
const r = (React as any).default || React;

const internals =
  r.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
  r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED ||
  r.__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
  {};

if (!internals.S) {
  internals.S = null;
}

if (!r.__CLIENT_INTERNALS__) {
  try {
    Object.defineProperty(r, "__CLIENT_INTERNALS__", {
      value: internals,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    // fallback if defineProperty fails
    try {
      r.__CLIENT_INTERNALS__ = internals;
    } catch {}
  }
}

if (!r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
  try {
    Object.defineProperty(r, "__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED", {
      value: internals,
      configurable: true,
      enumerable: false,
      writable: true,
    });
  } catch {
    try {
      r.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = internals;
    } catch {}
  }
}
