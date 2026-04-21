"use client";
import React from "react";
import { Provider } from "react-redux";
import { getStore } from "./index";

export function ReduxProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={getStore()}>{children}</Provider>;
}
