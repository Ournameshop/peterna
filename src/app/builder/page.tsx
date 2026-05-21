"use client";

import React from 'react';
import { PALETTE } from './lib/palette';
import { BuilderProvider } from './state';
import { WizardProvider } from './shell/Wizard';
import TopBar from './shell/TopBar';
import Wizard from './shell/Wizard';

export default function BuilderPage() {
  return (
    <BuilderProvider>
      <WizardProvider>
        <div style={{ minHeight: '100vh', background: PALETTE.bone, color: PALETTE.espresso }}>
          <TopBar />
          <Wizard />
        </div>
      </WizardProvider>
    </BuilderProvider>
  );
}
