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
let modalPreviouslyFocusedElement = null;
let modalKeydownHandler = null;

function getModalFocusableElements(container) {
    if (!container) return [];

    return Array.from(container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )).filter((element) => {
        if (!element) return false;
        if (element.disabled) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        return element.offsetParent !== null || document.activeElement === element;
    });
}

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
        <div class="modal-content" role="dialog" aria-modal="true" tabindex="-1">
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

    modalPreviouslyFocusedElement = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    modalPreviouslyFocusedElement?.blur?.();

    overlay.classList.add('active');

    document.getElementById('modal-save-btn').onclick = () => {
        onSave();
    };

    const modalContent = overlay.querySelector('.modal-content');
    const focusableElements = getModalFocusableElements(modalContent);
    const preferredFocusElement = focusableElements.find((element) =>
        element.matches('input:not([type="hidden"]), select, textarea, button')
    );

    window.setTimeout(() => {
        (preferredFocusElement || modalContent)?.focus?.();
    }, 0);

    if (modalKeydownHandler) {
        document.removeEventListener('keydown', modalKeydownHandler, true);
    }

    modalKeydownHandler = (event) => {
        const currentOverlay = document.getElementById('modal-overlay');
        if (!currentOverlay?.classList.contains('active')) return;

        const currentModal = currentOverlay.querySelector('.modal-content');
        if (!currentModal) return;

        if (!currentModal.contains(event.target)) {
            event.stopPropagation();
        }

        if (event.key !== 'Tab') return;

        const currentFocusable = getModalFocusableElements(currentModal);
        if (!currentFocusable.length) {
            event.preventDefault();
            currentModal.focus();
            return;
        }

        const firstElement = currentFocusable[0];
        const lastElement = currentFocusable[currentFocusable.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    };

    document.addEventListener('keydown', modalKeydownHandler, true);
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('active');

    if (modalKeydownHandler) {
        document.removeEventListener('keydown', modalKeydownHandler, true);
        modalKeydownHandler = null;
    }

    if (modalPreviouslyFocusedElement && document.contains(modalPreviouslyFocusedElement)) {
        window.setTimeout(() => {
            modalPreviouslyFocusedElement?.focus?.();
        }, 0);
    }

    modalPreviouslyFocusedElement = null;
}
