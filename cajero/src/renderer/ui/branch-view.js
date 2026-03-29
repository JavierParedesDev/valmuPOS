import { escapeHtml } from '../utils/formatters.js';

export function renderBranchSelectView({ branches, selectedBranchId, fallbackBranchId, unavailable = false }) {
    const branchSelect = document.getElementById('branch-select');
    if (!branchSelect) {
        return;
    }

    if (unavailable) {
        branchSelect.innerHTML = '<option value="">Sucursal no disponible</option>';
        return;
    }

    if (!branches.length) {
        branchSelect.innerHTML = fallbackBranchId
            ? `<option value="${escapeHtml(String(fallbackBranchId))}">Sucursal actual</option>`
            : '<option value="">Sin sucursales</option>';
        return;
    }

    branchSelect.innerHTML = branches.map((branch) => `
        <option value="${escapeHtml(branch.id_sucursal)}" ${String(branch.id_sucursal) === String(selectedBranchId) ? 'selected' : ''}>
            ${escapeHtml(branch.nombreSucursal || `Sucursal ${branch.id_sucursal}`)}
        </option>
    `).join('');
}
