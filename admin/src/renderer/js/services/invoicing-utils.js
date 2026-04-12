window.ValmuInvoicingUtils = {
    sanitizeString(str) {
        if (!str) return "";

        return String(str)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9\s\.\,\-]/g, "")
            .trim();
    },

    b64toBlob(base64, type = 'application/octet-stream') {
        const raw = window.atob(base64);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);

        for (let i = 0; i < rawLength; i += 1) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], { type });
    }
};
