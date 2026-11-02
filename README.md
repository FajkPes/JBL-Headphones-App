# JBL Headphones App

A Windows-oriented Web Bluetooth control panel and protocol mapping guide for
JBL TUNE 720BT and JBL TUNE 780NC headphones.

I created this project to understand the settings exposed by JBL headphones
and make them inspectable from a PC. It can read mapped values, show raw GATT
traffic, explore read-only protocol queries, and—after explicit confirmation—
write selected settings. The primary purpose is research, mapping, diagnostics,
and careful experimentation.

> [!CAUTION]
> This is unofficial reverse-engineering software. Writing undocumented values
> can change persistent headphone settings, interrupt audio, break pairing, or
> leave a feature unusable until it is restored with the official app or a
> factory reset. Read first, create a backup, and change one setting at a time.

## Supported models

- **JBL TUNE 720BT** — Protocol 3 mapping verified on real hardware.
- **JBL TUNE 780NC** — Protocol 4 reference mapping derived from protocol data
  and covered by automated tests, but not yet verified on physical hardware.

Only controls mapped for the selected model are displayed. Unsupported or
unverified features are not presented as ordinary safe controls.

## Main features

- Connects through Web Bluetooth GATT in Chrome or Edge.
- Reads individual settings or all mapped settings in small batches.
- Marks settings that received a real response from the headphones.
- Offers read-only protocol exploration and exports the results as a ZIP.
- Backs up readable settings to an English ZIP report and restores only
  explicitly selected, compatible, non-dangerous differences.
- Supports raw diagnostics, protocol logs, codec parameters, EQ data,
  voice prompts, power settings, controls, and model-specific features.
- Classifies risky operations and confirms every write.
- Permanently blocks known destructive byte sequences, including factory reset,
  OTA entry, authentication changes, host-address changes, unpairing, and
  hearing-protection PIN writes.

## Quick start

1. Download and extract the release ZIP.
2. Run **`START JBL Headphones App.bat`**.
3. If Python is missing, the launcher explains where to install Python 3 and
   how to add it to `PATH`.
4. Chrome or Edge opens `http://localhost:8777/select.html`.
5. Select your headphone model, choose **Connect**, and select the headphones
   in the browser's Bluetooth chooser.
6. Start with **Read all**. Do not enable **Risky writes** until you have read
   the warning and created a backup.

The app must run from `http://localhost`; Web Bluetooth and JavaScript modules
do not work correctly when the HTML file is opened directly with `file://`.

## Requirements

- Windows 10 or 11
- Google Chrome or Microsoft Edge with Web Bluetooth support
- Python 3 (standard library only; no `pip install` is required)
- A Bluetooth Low Energy adapter
- Headphones already paired with Windows

No Node.js dependency is required to run the app. Node.js is only used for the
developer test suite.

[Detailed documentation](README-DETAILS.md) · [All releases](https://github.com/FajkPes/JBL-Headphones-App/releases)
