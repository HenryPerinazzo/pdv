// js/db.js - Nosso "banco de dados" falso que usa o LocalStorage.

const db = {
    save: (key, data) => { localStorage.setItem(key, JSON.stringify(data)); },
    load: (key) => {
        const data = localStorage.getItem(key);
        if (data) { return JSON.parse(data); }
        if (key === 'sale_counter') return 1000;
        if (key === 'brands') return initialData.brands;
        if (key === 'company_data') return initialData.company_data;
        return [];
    },
    init: () => {
        if (!localStorage.getItem('db_initialized')) {
            console.log("Iniciando o banco de dados com dados de exemplo...");
            db.save('clients', initialData.clients);
            db.save('products', initialData.products);
            db.save('orders', initialData.orders);
            db.save('brands', initialData.brands);
            db.save('company_data', initialData.company_data);
            db.save('sales', []);
            db.save('payments', []);
            db.save('sale_counter', initialData.sale_counter || 1000);
            localStorage.setItem('db_initialized', 'true');
        }
    }
};
