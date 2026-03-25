window.AdminNavigation = {
    getInitialPage(routes) {
        const requestedPage = window.location.hash.replace('#', '');
        return routes[requestedPage] ? requestedPage : 'dashboard';
    },

    setActiveNav(page) {
        const navItems = document.querySelectorAll('.nav-item, .sidebar-settings-link');

        navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    },

    updatePageTitle(page, routes) {
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = routes[page]?.title || 'Valmu Admin';
        }
    },

    bindNavigation(routes, onNavigate) {
        const navItems = document.querySelectorAll('.nav-item, .sidebar-settings-link');

        navItems.forEach((item) => {
            item.addEventListener('click', (event) => {
                event.preventDefault();

                const page = item.dataset.page;
                if (!routes[page]) {
                    onNavigate(page);
                    return;
                }

                this.setActiveNav(page);
                this.updatePageTitle(page, routes);
                onNavigate(page);
                window.location.hash = page;
            });
        });
    }
};
