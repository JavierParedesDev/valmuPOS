const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

function formatDate(dateString) {
    if (!dateString) return '-';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

function updateQtyStep(selectElement, inputId) {
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const isPesable = selectedOption.getAttribute('data-pesable') === '1';
    const input = document.getElementById(inputId);
    if (input) {
        input.step = isPesable ? "0.001" : "1";
        input.placeholder = isPesable ? "0.000" : "0";
    }
}

// --- MODAL SYSTEM ---
function showModal(title, contentHtml, onSave) {
    // Create overlay if not exists
    let overlay = document.getElementById('modal-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modal-overlay';
        overlay.className = 'modal-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div class="modal-body">
                ${contentHtml}
            </div>
            <div class="modal-footer">
                <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
                <button class="btn btn-primary" id="modal-save-btn">Guardar Cambios</button>
            </div>
        </div>
        `;

    overlay.classList.add('active');

    document.getElementById('modal-save-btn').onclick = () => {
        onSave();
    };
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');
}
