import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { GuildSummary } from "@discasa/shared";
import type { SettingsSection } from "../ui-types";
import { BaseModal } from "./BaseModal";
import { ProfileAvatar } from "./ProfileAvatar";

type SettingsModalProps = {
  profile: {
    nickname: string;
    server: string;
    avatarUrl: string | null;
  };
  settingsSection: SettingsSection;
  sessionName: string | null;
  guilds: GuildSummary[];
  selectedGuildId: string;
  activeGuildName: string | null;
  isLoadingGuilds: boolean;
  isApplyingGuild: boolean;
  discordSettingsError: string;
  minimizeToTray: boolean;
  closeToTray: boolean;
  accentColor: string;
  accentInput: string;
  accentInputError: string;
  onClose: () => void;
  onSelectSection: (section: SettingsSection) => void;
  onOpenDiscordLogin: () => void;
  onOpenDiscordBotInstall: () => void;
  onSelectGuild: (guildId: string) => void;
  onApplyGuild: () => void;
  onChangeMinimizeToTray: (checked: boolean) => void;
  onChangeCloseToTray: (checked: boolean) => void;
  onAccentInputChange: (value: string) => void;
  onAccentInputBlur: () => void;
};

type HsvColor = {
  hue: number;
  saturation: number;
  value: number;
};

const settingsSections: Array<{ id: SettingsSection; label: string }> = [
  { id: "discord", label: "Discord" },
  { id: "appearance", label: "Appearance" },
  { id: "window", label: "Window" },
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeHexColor(value: string): string | null {
  const raw = value.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    const expanded = raw
      .split("")
      .map((character) => `${character}${character}`)
      .join("");

    return `#${expanded.toUpperCase()}`;
  }

  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw.toUpperCase()}`;
  }

  return null;
}

function hexToRgb(hex: string): { red: number; green: number; blue: number } {
  const normalized = normalizeHexColor(hex) ?? "#E9881D";
  const value = normalized.slice(1);

  return {
    red: Number.parseInt(value.slice(0, 2), 16),
    green: Number.parseInt(value.slice(2, 4), 16),
    blue: Number.parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function rgbToHsv(red: number, green: number, blue: number): HsvColor {
  const normalizedRed = red / 255;
  const normalizedGreen = green / 255;
  const normalizedBlue = blue / 255;

  const max = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const min = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = max - min;

  let hue = 0;

  if (delta !== 0) {
    if (max === normalizedRed) {
      hue = ((normalizedGreen - normalizedBlue) / delta) % 6;
    } else if (max === normalizedGreen) {
      hue = (normalizedBlue - normalizedRed) / delta + 2;
    } else {
      hue = (normalizedRed - normalizedGreen) / delta + 4;
    }
  }

  hue = Math.round(hue * 60);
  if (hue < 0) {
    hue += 360;
  }

  const saturation = max === 0 ? 0 : delta / max;
  const value = max;

  return {
    hue,
    saturation,
    value,
  };
}

function hsvToRgb(hue: number, saturation: number, value: number): { red: number; green: number; blue: number } {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const chroma = value * saturation;
  const huePrime = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime >= 1 && huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime >= 2 && huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime >= 3 && huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime >= 4 && huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = value - chroma;

  return {
    red: Math.round((red + match) * 255),
    green: Math.round((green + match) * 255),
    blue: Math.round((blue + match) * 255),
  };
}

function hexToHsv(hex: string): HsvColor {
  const { red, green, blue } = hexToRgb(hex);
  return rgbToHsv(red, green, blue);
}

function hsvToHex(hue: number, saturation: number, value: number): string {
  const { red, green, blue } = hsvToRgb(hue, saturation, value);
  return rgbToHex(red, green, blue);
}

type AccentColorPickerProps = {
  color: string;
  accentInputError: string;
  onCommitHex: (nextHex: string) => void;
};

function AccentColorPicker({ color, accentInputError, onCommitHex }: AccentColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftHex, setDraftHex] = useState(color);
  const [draftHsv, setDraftHsv] = useState<HsvColor>(() => hexToHsv(color));
  const [draftError, setDraftError] = useState("");
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const saturationPanelRef = useRef<HTMLDivElement | null>(null);
  const hueTrackRef = useRef<HTMLDivElement | null>(null);
  const draftHexRef = useRef(draftHex);

  useEffect(() => {
    const normalized = normalizeHexColor(color) ?? color;
    setDraftHex(normalized);
    setDraftHsv(hexToHsv(normalized));
  }, [color]);

  useEffect(() => {
    draftHexRef.current = draftHex;
  }, [draftHex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (anchorRef.current?.contains(event.target as Node)) {
        return;
      }

      resetDraft();
      setIsOpen(false);
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      resetDraft();
      setIsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, color]);

  const hueOnlyColor = useMemo(() => hsvToHex(draftHsv.hue, 1, 1), [draftHsv.hue]);
  const displayHex = isOpen ? draftHex : color;
  const helperText = draftError || accentInputError || "Click the swatch to open the picker.";

  function resetDraft(): void {
    const normalized = normalizeHexColor(color) ?? color;
    const nextHsv = hexToHsv(normalized);
    draftHexRef.current = normalized;
    setDraftHex(normalized);
    setDraftHsv(nextHsv);
    setDraftError("");
  }

  function commitHex(nextHex: string): boolean {
    const normalized = normalizeHexColor(nextHex);

    if (!normalized) {
      setDraftError("Enter a valid HEX color.");
      return false;
    }

    const nextHsv = hexToHsv(normalized);
    draftHexRef.current = normalized;
    setDraftHex(normalized);
    setDraftHsv(nextHsv);
    setDraftError("");
    onCommitHex(normalized);
    return true;
  }

  function updateDraftFromHsv(nextHue: number, nextSaturation: number, nextValue: number): void {
    const normalizedHue = clampNumber(nextHue, 0, 360);
    const normalizedSaturation = clampNumber(nextSaturation, 0, 1);
    const normalizedValue = clampNumber(nextValue, 0, 1);
    const nextHex = hsvToHex(normalizedHue, normalizedSaturation, normalizedValue);
    const nextHsv = {
      hue: normalizedHue,
      saturation: normalizedSaturation,
      value: normalizedValue,
    };

    draftHexRef.current = nextHex;
    setDraftHsv(nextHsv);
    setDraftHex(nextHex);
    setDraftError("");
  }

  function updateSaturationFromClientPoint(clientX: number, clientY: number): void {
    const panel = saturationPanelRef.current;
    if (!panel) {
      return;
    }

    const rect = panel.getBoundingClientRect();
    const nextSaturation = clampNumber((clientX - rect.left) / rect.width, 0, 1);
    const nextValue = clampNumber(1 - (clientY - rect.top) / rect.height, 0, 1);
    updateDraftFromHsv(draftHsv.hue, nextSaturation, nextValue);
  }

  function updateHueFromClientPoint(clientX: number): void {
    const track = hueTrackRef.current;
    if (!track) {
      return;
    }

    const rect = track.getBoundingClientRect();
    const ratio = clampNumber((clientX - rect.left) / rect.width, 0, 1);
    updateDraftFromHsv(ratio * 360, draftHsv.saturation, draftHsv.value);
  }

  function handleSaturationPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    updateSaturationFromClientPoint(event.clientX, event.clientY);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateSaturationFromClientPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      void commitHex(draftHexRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleHuePointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    updateHueFromClientPoint(event.clientX);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateHueFromClientPoint(moveEvent.clientX);
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      void commitHex(draftHexRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp, { once: true });
  }

  function handleHexInputChange(event: ChangeEvent<HTMLInputElement>): void {
    const nextValue = event.currentTarget.value.toUpperCase();
    setDraftHex(nextValue);

    const normalized = normalizeHexColor(nextValue);
    if (!normalized) {
      setDraftError(nextValue.trim().length === 0 ? "Enter a valid HEX color." : "Enter a valid HEX color.");
      return;
    }

    setDraftError("");
    setDraftHsv(hexToHsv(normalized));
  }

  function handleHexInputBlur(): void {
    if (!commitHex(draftHex)) {
      return;
    }

    setIsOpen(false);
  }

  function handleHexInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      if (commitHex(draftHex)) {
        setIsOpen(false);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetDraft();
      setIsOpen(false);
    }
  }

  function handleTogglePicker(): void {
    if (isOpen) {
      resetDraft();
      setIsOpen(false);
      return;
    }

    resetDraft();
    setIsOpen(true);
  }

  return (
    <div className="settings-field-stack">
      <label className="settings-input-label" htmlFor="accent-hex-display">
        Accent color (HEX)
      </label>

      <div className="settings-color-row">
        <div ref={anchorRef} className="settings-color-picker-anchor">
          <button
            type="button"
            className="settings-color-preview-button"
            aria-label="Open accent color picker"
            aria-expanded={isOpen}
            onClick={handleTogglePicker}
          >
            <span
              className="settings-color-preview settings-color-preview-large"
              aria-hidden="true"
              style={{ backgroundColor: displayHex }}
            />
          </button>

          {isOpen ? (
            <div className="settings-color-picker-popover" role="dialog" aria-label="Accent color picker">
              <div
                ref={saturationPanelRef}
                className="settings-color-picker-surface"
                style={{
                  backgroundColor: hueOnlyColor,
                  backgroundImage: `
                    linear-gradient(180deg, transparent 0%, #000000 100%),
                    linear-gradient(90deg, #FFFFFF 0%, transparent 100%)
                  `,
                }}
                onPointerDown={handleSaturationPointerDown}
              >
                <span
                  className="settings-color-picker-handle"
                  aria-hidden="true"
                  style={{
                    left: `calc(${draftHsv.saturation * 100}% - 8px)`,
                    top: `calc(${(1 - draftHsv.value) * 100}% - 8px)`,
                  }}
                />
              </div>

              <div ref={hueTrackRef} className="settings-color-picker-hue" onPointerDown={handleHuePointerDown}>
                <span
                  className="settings-color-picker-handle settings-color-picker-handle-horizontal"
                  aria-hidden="true"
                  style={{
                    left: `calc(${(draftHsv.hue / 360) * 100}% - 8px)`,
                  }}
                />
              </div>

              <div className="settings-color-picker-hex-block">
                <span
                  className="settings-color-preview settings-color-picker-current"
                  aria-hidden="true"
                  style={{ backgroundColor: draftHex }}
                />
                <label className="settings-color-picker-hex-field">
                  <span className="settings-color-picker-hex-label">Hex</span>
                  <input
                    className={`form-text-input settings-color-picker-hex-input ${draftError ? "invalid" : ""}`}
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={7}
                    value={draftHex}
                    onChange={handleHexInputChange}
                    onBlur={handleHexInputBlur}
                    onKeyDown={handleHexInputKeyDown}
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>

        <input
          id="accent-hex-display"
          className="form-text-input settings-color-display-input"
          type="text"
          value={color}
          readOnly
          aria-readonly="true"
        />
      </div>

      <span className={`settings-input-help ${draftError || accentInputError ? "error" : ""}`}>{helperText}</span>
    </div>
  );
}

export function SettingsModal({
  profile,
  settingsSection,
  sessionName,
  guilds,
  selectedGuildId,
  activeGuildName,
  isLoadingGuilds,
  isApplyingGuild,
  discordSettingsError,
  minimizeToTray,
  closeToTray,
  accentColor,
  accentInput: _accentInput,
  accentInputError,
  onClose,
  onSelectSection,
  onOpenDiscordLogin,
  onOpenDiscordBotInstall,
  onSelectGuild,
  onApplyGuild,
  onChangeMinimizeToTray,
  onChangeCloseToTray,
  onAccentInputChange,
  onAccentInputBlur: _onAccentInputBlur,
}: SettingsModalProps) {
  function renderGuildOptions() {
    if (isLoadingGuilds) {
      return <option value="">Loading servers...</option>;
    }

    if (!guilds.length) {
      return <option value="">No eligible servers found</option>;
    }

    return [
      <option key="placeholder" value="">
        Select a server
      </option>,
      ...guilds.map((guild) => (
        <option key={guild.id} value={guild.id}>
          {guild.name}
        </option>
      )),
    ];
  }

  function renderDiscordContent() {
    return (
      <>
        <div className="settings-modal-header">
          <div>
            <h2>Discord</h2>
            <p>Connect your Discord account, choose a server, add the bot in the browser, then return here and apply that server.</p>
          </div>
        </div>

        <div className="settings-card panel-surface-secondary">
          <div className={`settings-status ${sessionName ? "connected" : "disconnected"}`}>
            {sessionName ? `Connected as ${sessionName}` : "Not connected"}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <button className="pill-button accent-button primary-button" onClick={onOpenDiscordLogin}>
              {sessionName ? "Reconnect Discord" : "Login with Discord"}
            </button>

            <button
              className="pill-button secondary-button primary-button"
              onClick={onOpenDiscordBotInstall}
              disabled={!sessionName || !selectedGuildId}
            >
              Add bot to selected server
            </button>
          </div>

          <span className="settings-input-help">
            The bot installation opens in your default browser so the Discasa window stays intact.
          </span>

          <div className="settings-field-stack">
            <label className="settings-input-label" htmlFor="discord-server-select">
              Target server
            </label>
            <select
              id="discord-server-select"
              className="form-text-input settings-select-input"
              value={selectedGuildId}
              disabled={!sessionName || isLoadingGuilds || !guilds.length}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => onSelectGuild(event.currentTarget.value)}
            >
              {renderGuildOptions()}
            </select>
            <span className={`settings-input-help ${discordSettingsError ? "error" : ""}`}>
              {discordSettingsError ||
                (activeGuildName
                  ? `Current applied server: ${activeGuildName}`
                  : "Select the Discord server that Discasa should use.")}
            </span>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            <button
              className="pill-button secondary-button primary-button"
              onClick={onApplyGuild}
              disabled={!sessionName || !selectedGuildId || isApplyingGuild}
            >
              {isApplyingGuild ? "Applying..." : "Apply selected server"}
            </button>
          </div>
        </div>
      </>
    );
  }

  function renderContent() {
    if (settingsSection === "discord") {
      return renderDiscordContent();
    }

    if (settingsSection === "appearance") {
      return (
        <>
          <div className="settings-modal-header">
            <div>
              <h2>Appearance</h2>
              <p>Choose the accent color used by the colored elements across the interface.</p>
            </div>
          </div>

          <div className="settings-card panel-surface-secondary">
            <AccentColorPicker
              color={accentColor}
              accentInputError={accentInputError}
              onCommitHex={onAccentInputChange}
            />
          </div>
        </>
      );
    }

    return (
      <>
        <div className="settings-modal-header">
          <div>
            <h2>Window</h2>
            <p>Choose how Discasa behaves when minimizing or closing.</p>
          </div>
        </div>

        <div className="settings-card panel-surface-secondary">
          <label className="settings-toggle" htmlFor="minimize-to-tray">
            <div className="settings-toggle-copy">
              <span className="settings-toggle-title">Minimize to tray</span>
              <span className="settings-toggle-description">When minimizing, hide the app in the system tray.</span>
            </div>
            <input
              id="minimize-to-tray"
              className="settings-switch-input"
              type="checkbox"
              checked={minimizeToTray}
              onChange={(event) => onChangeMinimizeToTray(event.currentTarget.checked)}
            />
            <span className="settings-switch" aria-hidden="true" />
          </label>

          <label className="settings-toggle" htmlFor="close-to-tray">
            <div className="settings-toggle-copy">
              <span className="settings-toggle-title">Close to tray</span>
              <span className="settings-toggle-description">When closing, keep the app running in the system tray.</span>
            </div>
            <input
              id="close-to-tray"
              className="settings-switch-input"
              type="checkbox"
              checked={closeToTray}
              onChange={(event) => onChangeCloseToTray(event.currentTarget.checked)}
            />
            <span className="settings-switch" aria-hidden="true" />
          </label>
        </div>
      </>
    );
  }

  return (
    <BaseModal
      rootClassName="settings-modal-root"
      backdropClassName="settings-modal-backdrop"
      panelClassName="settings-modal"
      ariaLabel="Discasa settings"
      showCloseButton
      closeButtonClassName="settings-modal-close"
      closeButtonAriaLabel="Close settings"
      onClose={onClose}
    >
      <aside className="settings-modal-sidebar">
        <div className="settings-modal-profile">
          <ProfileAvatar avatarUrl={profile.avatarUrl} className="settings-modal-avatar" />
          <div className="settings-modal-profile-copy">
            <span className="settings-profile-primary">{profile.nickname}</span>
            <span className="settings-profile-secondary">{profile.server}</span>
          </div>
        </div>

        <div className="settings-modal-nav-group">
          <span className="settings-modal-nav-label">Settings</span>
          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`settings-modal-nav-item ${settingsSection === section.id ? "active" : ""}`}
              onClick={() => onSelectSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="settings-modal-content scrollable-y subtle-scrollbar content-scrollbar-host">
        {renderContent()}
      </section>
    </BaseModal>
  );
}
