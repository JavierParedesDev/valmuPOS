window.AdminNavigation = {
    resolveRoutes(routes) {
        if (typeof routes === 'function') {
            return routes() || {};
        }

        return routes || {};
    },

    getInitialPage(routes) {
        const routeMap = this.resolveRoutes(routes);
        const requestedPage = window.location.hash.replace('#', '');
        return routeMap[requestedPage] ? requestedPage : 'dashboard';
    },

    setActiveNav(page) {
        const navItems = document.querySelectorAll('.nav-item, .sidebar-settings-link');

        navItems.forEach((item) => {
            item.classList.toggle('active', item.dataset.page === page);
        });
    },

    updatePageTitle(page, routes) {
        const routeMap = this.resolveRoutes(routes);
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = routeMap[page]?.title || 'Valmu Admin';
        }
    },

    bindNavigation(routes, onNavigate) {
        const navItems = document.querySelectorAll('.nav-item, .sidebar-settings-link');

        navItems.forEach((item) => {
            item.addEventListener('click', (event) => {
                event.preventDefault();

                const routeMap = this.resolveRoutes(routes);
                const page = item.dataset.page;
                if (!routeMap[page]) {
                    onNavigate(page);
                    return;
                }

                this.setActiveNav(page);
                this.updatePageTitle(page, routeMap);
                onNavigate(page);
                window.location.hash = page;
            });
        });
    }
};
