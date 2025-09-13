// js/data.js - Dados iniciais para popular o sistema na primeira vez.

const initialData = {
    clients: [
        { id: 0, name: 'Venda Rápida / Balcão', phone: '', email: '', isActive: true },
        { id: 1, name: 'Ana Perinazzo', phone: '11987654321', email: 'ana@email.com', isActive: true },
        { id: 2, name: 'Henry Perinazzo', phone: '11912345678', email: 'henry@email.com', isActive: true },
        { id: 3, name: 'Evelin', phone: '11999998888', email: 'evelin@email.com', isActive: true },
        { id: 4, name: 'Rosângela', phone: '11977776666', email: 'rosangela@email.com', isActive: true }
    ],
    products: [
        { id: 101, name: 'Desodorante Roll-on Erva Doce', brand: 'Natura', cycle: '10/2025', costPrice: 15.90, salePrice: 23.90, stock: 10, isActive: true },
        { id: 102, name: 'Shampoo Liso e Solto', brand: 'Natura', cycle: '10/2025', costPrice: 20.50, salePrice: 32.90, stock: 5, isActive: true },
        { id: 201, name: 'Batom Power Stay Vermelhaço', brand: 'Avon', cycle: 'C11/25', costPrice: 25.00, salePrice: 44.99, stock: 8, isActive: true },
        { id: 202, name: 'Máscara de Cílios Supershock', brand: 'Avon', cycle: 'C11/25', costPrice: 18.90, salePrice: 29.90, stock: 12, isActive: true }
    ],
    orders: [
        { id: 1, clientId: 3, productId: 102, quantity: 1, status: 'Solicitado', requestDate: '2025-09-01' },
        { id: 2, clientId: 4, productId: 201, quantity: 2, status: 'Pedido Realizado', requestDate: '2025-09-03' },
        { id: 3, clientId: 1, productId: 202, quantity: 1, status: 'Chegou', requestDate: '2025-08-28' },
        { id: 4, clientId: 2, productId: 101, quantity: 1, status: 'Cancelado', requestDate: '2025-08-20' }
    ],
    brands: [
        { id: 1, name: "Natura", isActive: true },
        { id: 2, name: "Avon", isActive: true },
        { id: 3, name: "O Boticário", isActive: true }
    ],
    company_data: {
        name: "Dariane Consultora",
        cnpj: "XX.XXX.XXX/0001-XX",
        address: "Sua Rua, 123",
        city: "Bragança Paulista/SP",
        zip: "12900-000",
        phone: "(11) 9XXXX-XXXX",
        receiptMessage: "Obrigado e volte sempre!"
    },
    sale_counter: 1000
};
