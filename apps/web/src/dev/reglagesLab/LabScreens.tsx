/**
 * Les ÉCRANS du monde : les routes des réglages, de l'administration, de la connexion, des
 * profils, de l'assistant et de l'aide, telles que `App.tsx` les monte — les mêmes modules
 * paresseux, les mêmes éléments. La barre du haut (axe « accueil ») n'y est pas : une bande
 * neutre tient sa place, pour que les décalages collants (`--topnav-height`) soient les vrais.
 */

import { lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import {
  About, AdminDownloads, AdminHome, AdminInvites, AdminLayout, AdminMetadata, AdminPlugins, AdminServicesPage,
  AdminSessions, AdminTicketsPage, AdminUsers, Credits, Login, PairDevice, Preferences, Register, SettingsAppearance,
  SettingsDownloads, SettingsFamily, SettingsIndex, SettingsLayout, SettingsPersonalization, SettingsSecurity, Support,
  TrailerGuide,
} from "../../lazyPages";
import { LabWhoIsWatching } from "./LabWhoIsWatching";

const SetupWizard = lazy(() => import("../../components/setupWizard/SetupWizard"));

/** Les pages servies SANS la coquille de l'application (plein écran). */
const BARE = /^\/(login|register|lab\/)/;

export function LabScreens() {
  const { pathname } = useLocation();
  const bare = BARE.test(pathname);
  return (
    <div className="relative min-h-screen bg-surface-0 text-content-primary">
      {bare ? null : (
        <div aria-hidden className="absolute inset-x-0 top-0 z-10 flex h-[68px] items-center px-8 text-xs text-content-quaternary">
          barre du haut — axe « accueil »
        </div>
      )}
      <div className={bare ? "" : "pt-[68px]"}>
        <Routes>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<SettingsIndex />} />
            <Route path="appearance" element={<SettingsAppearance />} />
            <Route path="personalization" element={<SettingsPersonalization />} />
            <Route path="security" element={<SettingsSecurity />} />
            <Route path="family" element={<SettingsFamily />} />
            <Route path="playback" element={<Preferences />} />
            <Route path="languages" element={<Preferences />} />
            <Route path="downloads" element={<SettingsDownloads />} />
          </Route>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminHome />} />
            <Route path="sessions" element={<AdminSessions />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="family" element={<AdminUsers section="family" />} />
            <Route path="downloads" element={<AdminDownloads />} />
            <Route path="invites" element={<AdminInvites />} />
            <Route path="tickets" element={<AdminTicketsPage />} />
            <Route path="services" element={<AdminServicesPage />} />
            <Route path="remote-access" element={<AdminServicesPage section="remote-access" />} />
            <Route path="system" element={<AdminServicesPage section="system" />} />
            <Route path="metadata" element={<AdminMetadata />} />
            <Route path="plugins" element={<AdminPlugins />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/pair-device" element={<PairDevice />} />
          <Route path="/support" element={<Support />} />
          <Route path="/help/trailers" element={<TrailerGuide />} />
          <Route path="/about" element={<About />} />
          <Route path="/credits" element={<Credits />} />
          <Route path="/lab/who" element={<LabWhoIsWatching />} />
          <Route path="/lab/setup" element={<SetupWizard onComplete={() => undefined} />} />
          <Route path="*" element={<Navigate to="/settings" replace />} />
        </Routes>
      </div>
    </div>
  );
}
