// catalog.js - Dynamic Brand Landing + Filtering

const allProducts = [
    // Add your full products here from MASTER sheet
    { id: "HY-HP602", brand: "Hytera", name: "HP602", msrp: 577.50, image: "hytera/images/hp602.png", description: "Professional DMR handheld" },
    { id: "IC-V3MR", brand: "Icom", name: "V3MR", msrp: 259.00, image: "icom/images/v3mr.png", description: "MURS portable" },
    // ...
];

function getBrandFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('brand') || 'all';
}

function renderProducts(filtered) {
    const container = document.getElementById('productsContainer');
    container.innerHTML = filtered.map(p => `
        <div class="product-card">
            <img src="${p.image}" alt="${p.name}" onerror="this.src='images/default-product.jpg'">
            <div class="product-info">
                <span class="brand">${p.brand}</span>
                <h3>${p.name}</h3>
                <p class="price">$${p.msrp.toFixed(2)}</p>
                <a href="product.html?id=${p.id}" class="btn-view">View Details</a>
            </div>
        </div>
    `).join('');
}

function updateBrandHero(brand) {
    const hero = document.getElementById('brandHero');
    if (!hero) return;

    const heroes = {
        'hytera': { title: 'Hytera Systems Portfolio', subtitle: 'Rugged DMR and PoC solutions for demanding environments.' },
        'icom': { title: 'Icom Land Mobile Radios', subtitle: 'Reliable analog and digital communication solutions.' },
        'kenwood': { title: 'Kenwood Professional Radios', subtitle: 'NXDN and DMR systems for mission-critical operations.' },
        'all': { title: 'Product Catalog', subtitle: 'Authorized dealer for professional two-way radio systems.' }
    };

    const data = heroes[brand.toLowerCase()] || heroes['all'];
    hero.innerHTML = `
        <h1>${data.title}</h1>
        <p>${data.subtitle}</p>
    `;
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const brand = getBrandFromUrl();
    updateBrandHero(brand);

    let filtered = allProducts;
    if (brand !== 'all') {
        filtered = allProducts.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
    }

    renderProducts(filtered);
	
	// Category filter click handler
document.querySelectorAll('.category-filter a').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        document.querySelectorAll('.category-filter a').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        const category = link.getAttribute('data-category');
        const brand = getBrandFromUrl();
        
        let filtered = allProducts;
        if (brand !== 'all') filtered = filtered.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
        if (category !== 'all') filtered = filtered.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
        
        renderProducts(filtered);
    });
});
});