import Constants from 'expo-constants';
import { Linking } from 'react-native';
import { APP_UPDATE_RELEASES_URL } from '../config/api';

function extractVersion(value) {
    const match = String(value || '').match(/(\d+\.\d+\.\d+)/);
    return match ? match[1] : '0.0.0';
}

function compareVersions(a, b) {
    const left = extractVersion(a).split('.').map((part) => parseInt(part, 10) || 0);
    const right = extractVersion(b).split('.').map((part) => parseInt(part, 10) || 0);
    const maxLength = Math.max(left.length, right.length);

    for (let index = 0; index < maxLength; index += 1) {
        const leftPart = left[index] || 0;
        const rightPart = right[index] || 0;

        if (leftPart > rightPart) return 1;
        if (leftPart < rightPart) return -1;
    }

    return 0;
}

function normalizeReleaseNotes(value) {
    return String(value || '')
        .replace(/#+\s?/g, '')
        .replace(/\r/g, '')
        .trim();
}

function getInstalledVersion() {
    return (
        Constants.expoConfig?.version ||
        Constants.manifest2?.extra?.expoClient?.version ||
        '0.0.0'
    );
}

function getApkAsset(release) {
    return (release?.assets || []).find((asset) => /\.apk$/i.test(asset?.name || ''));
}

function findLatestMobileRelease(releases) {
    return (Array.isArray(releases) ? releases : []).find((release) => Boolean(getApkAsset(release))) || null;
}

export async function checkForAppUpdate() {
    const installedVersion = getInstalledVersion();

    try {
        const response = await fetch(APP_UPDATE_RELEASES_URL, {
            headers: {
                Accept: 'application/vnd.github+json'
            }
        });

        if (!response.ok) {
            return {
                ok: false,
                installedVersion,
                error: 'No se pudo consultar el servicio de actualizaciones.'
            };
        }

        const releases = await response.json();
        const release = findLatestMobileRelease(releases);

        if (!release) {
            return {
                ok: true,
                installedVersion,
                updateAvailable: false,
                latestVersion: installedVersion,
                notes: '',
                assetUrl: '',
                publishedAt: null
            };
        }

        const asset = getApkAsset(release);
        const latestVersion = extractVersion(release.tag_name || release.name || asset?.name);
        const updateAvailable = compareVersions(latestVersion, installedVersion) > 0;

        return {
            ok: true,
            installedVersion,
            updateAvailable,
            latestVersion,
            notes: normalizeReleaseNotes(release.body),
            assetUrl: asset?.browser_download_url || '',
            assetName: asset?.name || '',
            publishedAt: release.published_at || null
        };
    } catch (_error) {
        return {
            ok: false,
            installedVersion,
            error: 'No se pudo revisar si existe una nueva version.'
        };
    }
}

export async function downloadAndInstallUpdate(updateInfo) {
    const assetUrl = updateInfo?.assetUrl;

    if (!assetUrl) {
        return {
            ok: false,
            error: 'La release no incluye un archivo APK descargable.'
        };
    }

    try {
        await Linking.openURL(assetUrl);
        return { ok: true, openedExternally: true };
    } catch (_error) {
        return {
            ok: false,
            error: 'No se pudo abrir el enlace de descarga de la nueva APK.'
        };
    }
}
