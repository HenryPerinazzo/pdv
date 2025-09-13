// js/app.js - O cérebro da aplicação (VERSÃO 4.6 - CORREÇÃO VIGILANTE DE IMPRESSÃO)

const app = {
    // --- ESTADO DA APLICAÇÃO ---
    currentSaleItems: [],
    currentSaleClient: null,
    editingClientId: null,
    editingProductId: null,
    currentDiscount: { type: 'R$', value: 0 },

    // --- INICIALIZAÇÃO ---
    init: () => {
        db.init();
        app.content = document.getElementById('app-content');
        if (!document.getElementById('modal-container')) { document.body.insertAdjacentHTML('beforeend', '<div id="modal-container"></div>'); }
        if (!document.getElementById('toast-container')) { document.body.insertAdjacentHTML('beforeend', '<div id="toast-container"></div>'); }
        app.setupEventListeners();
        app.renderVendas();
    },

    setupEventListeners: () => {
        document.getElementById('nav-pdv').addEventListener('click', () => app.renderVendas());
        document.getElementById('nav-encomendas').addEventListener('click', () => app.renderEncomendas());
        document.getElementById('nav-clientes').addEventListener('click', () => app.renderClientes());
        document.getElementById('nav-produtos').addEventListener('click', () => app.renderProdutos());
        document.getElementById('nav-reports').addEventListener('click', () => app.renderReports());
        document.getElementById('nav-quick-view').addEventListener('click', app.renderQuickView);
        document.getElementById('nav-settings').addEventListener('click', app.renderSettings);
    },

    // ----- RENDERIZAÇÃO DE PÁGINAS -----

    renderQuickView: () => {
        app.setActiveNav('nav-quick-view');
        const clients = db.load('clients');
        const products = db.load('products');
        const orders = db.load('orders');

        const clientsWithBalance = clients.map(client => ({ ...client, balance: app.calculateClientBalance(client.id) }))
            .filter(client => client.balance > 0 && client.id !== 0)
            .sort((a, b) => b.balance - a.balance);
        
        const debtorsHtml = clientsWithBalance.length > 0 
            ? `<ul style="list-style-type: none; padding: 0;">${clientsWithBalance.map(c => `<li>${c.name} - <strong>${app.masks.formatCurrency(c.balance)}</strong></li>`).join('')}</ul>`
            : '<p>Nenhum cliente com saldo devedor.</p>';
        
        const totalReceivable = clientsWithBalance.reduce((sum, c) => sum + c.balance, 0);

        app.content.innerHTML = `
            <div class="card"><h2>📊 Visão Rápida</h2><p>Um resumo da saúde do seu negócio.</p></div>
            <div class="quick-view-cards">
                <div class="stat-card"><div class="stat-card-value">${clients.filter(c => c.isActive && c.id !== 0).length}</div><div class="stat-card-label">Clientes Ativos</div></div>
                <div class="stat-card"><div class="stat-card-value">${products.filter(p => p.isActive).length}</div><div class="stat-card-label">Produtos Ativos</div></div>
                <div class="stat-card"><div class="stat-card-value">${orders.filter(o => o.status !== 'Cancelado').length}</div><div class="stat-card-label">Encomendas Ativas</div></div>
                <div class="stat-card"><div class="stat-card-value">${app.masks.formatCurrency(totalReceivable)}</div><div class="stat-card-label">Total a Receber</div></div>
            </div>
            <div class="card"><h3>Clientes a Receber</h3>${debtorsHtml}</div>
        `;
    },

    renderVendas: (preloadedData = null) => {
        app.setActiveNav('nav-pdv');
        app.currentSaleItems = [];
        app.currentSaleClient = null;
        app.currentDiscount = { type: 'R$', value: 0 };

        app.content.innerHTML = `
            <div class="pdv-layout">
                <div class="pdv-left-panel">
                    <div class="card">
                        <h3>1. Cliente</h3>
                        <div id="pdv-client-area">
                            <div class="form-group" style="position: relative;">
                                <div style="display: flex; gap: 5px;">
                                    <input type="text" id="pdv-client-search" placeholder="Buscar por nome ou telefone...">
                                    <button class="btn-icon btn-icon-add btn-success" id="pdv-add-client-btn" title="Adicionar Novo Cliente">➕</button>
                                </div>
                                <div id="pdv-client-results" class="autocomplete-results"></div>
                            </div>
                        </div>
                        <div id="pdv-selected-client" class="card" style="display:none; background-color: #eaf5ff; padding: 1rem; text-align: center;">
                            <p><strong><span id="selected-client-name"></span></strong></p>
                            <button class="btn btn-secondary" id="change-client-btn" style="padding: 5px 10px; font-size: 0.8rem; margin-top: 5px;">Trocar 🔄</button>
                        </div>
                    </div>
                    <div class="card">
                        <h3>2. Produtos</h3>
                        <div class="form-group" style="position: relative;">
                            <input type="text" id="pdv-product-search" placeholder="Buscar por nome, marca ou ciclo...">
                            <div id="pdv-product-results" class="autocomplete-results"></div>
                        </div>
                    </div>
                </div>
                <div class="pdv-right-panel">
                    <h3>3. Resumo da Venda</h3>
                    <div id="pdv-cart-items"><p>Carrinho vazio.</p></div>
                    <div id="pdv-discount-area" class="pdv-cart-item pdv-discount-item" style="display:none; justify-content: space-between;"></div>
                    <div id="pdv-total">Total: R$ 0,00</div>
                    <hr style="margin: 1.5rem 0;">
                    <h4>4. Finalizar</h4>
                    <button class="btn btn-secondary" id="btn-add-discount" style="width: 100%; margin-bottom: 10px;">% Aplicar Desconto</button>
                    <div id="pdv-payment-options" style="display: flex; flex-direction: column; gap: 10px;">
                        <button class="btn btn-success" id="btn-finalizar-vista">Finalizar à Vista</button>
                        <button class="btn btn-primary" id="btn-finalizar-prazo" style="display: none;">Finalizar a Prazo (Fiado)</button>
                    </div>
                </div>
            </div>`;
        
        document.getElementById('pdv-client-search').addEventListener('keyup', (e) => app.handleAutocomplete(e, 'clients', 'pdv-client-results', null, true, 'selectClientForSale'));
        document.getElementById('pdv-product-search').addEventListener('keyup', (e) => app.handleAutocomplete(e, 'products', 'pdv-product-results', null, true, 'selectProductForSale'));
        document.getElementById('pdv-add-client-btn').addEventListener('click', () => app.handleQuickAddClient('pdv'));
        document.getElementById('btn-add-discount').addEventListener('click', app.showDiscountModal);
        
        document.getElementById('btn-finalizar-vista').addEventListener('click', () => app.handleFinalizeSale('vista'));
        document.getElementById('btn-finalizar-prazo').addEventListener('click', () => app.handleFinalizeSale('prazo'));

        document.getElementById('pdv-client-search').dispatchEvent(new Event('keyup'));

        if(preloadedData && preloadedData.clientId !== undefined){
            app.selectClientForSale(preloadedData.clientId);
            if(preloadedData.productId){
                app.selectProductForSale(preloadedData.productId, preloadedData.quantity);
            }
        }
    },
    
    renderClientes: () => {
        app.setActiveNav('nav-clientes');
        app.content.innerHTML = `
            <div class="card" id="client-form-wrapper"></div>
            <div class="card">
                <div class="controls-header">
                    <h2>Lista de Clientes</h2>
                    <button class="btn btn-primary" id="btn-show-add-client-form">➕ Adicionar Novo Cliente</button>
                    <div class="filter-group">
                        <select id="client-status-filter"><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></select>
                        <select id="client-sort"><option value="az">A-Z</option><option value="za">Z-A</option></select>
                    </div>
                </div>
                <div class="form-group search-group">
                    <input type="text" id="client-search" placeholder="Buscar por nome ou telefone...">
                    <button class="btn btn-secondary" id="client-clear-search">Limpar</button>
                </div>
                <table id="clients-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Saldo</th><th>Ações</th></tr></thead><tbody></tbody></table>
            </div>`;

        app.showClientForm();
        app.updateClientList();
        
        document.getElementById('btn-show-add-client-form').addEventListener('click', () => app.toggleForm('add-client-form-container', 'btn-show-add-client-form', true));
        document.getElementById('client-status-filter').addEventListener('change', app.updateClientList);
        document.getElementById('client-sort').addEventListener('change', app.updateClientList);
        document.getElementById('client-search').addEventListener('keyup', app.updateClientList);
        document.getElementById('client-clear-search').addEventListener('click', () => {
            document.getElementById('client-search').value = '';
            app.updateClientList();
        });
    },

    renderClientDetail: (clientId) => {
        app.setActiveNav('nav-clientes');
        const client = db.load('clients').find(c => c.id === clientId);
        if (!client) { app.ui.showToast("Cliente não encontrado.", "error"); app.renderClientes(); return; }
        const balance = app.calculateClientBalance(clientId);
        const salesHistory = db.load('sales').filter(sale => sale.clientId === clientId).sort((a,b) => b.id - a.id);
        const salesTableRows = salesHistory.map(sale => {
            const isCanceled = sale.status === 'Cancelada';
            const saleProfit = sale.items.reduce((sum, item) => sum + ((item.unitPrice - (item.costPrice || 0)) * item.quantity), 0);
            return `
            <tr class="${isCanceled ? 'sale-canceled-row' : ''}">
                <td>#${sale.orderNumber}</td>
                <td>${new Date(sale.date).toLocaleDateString('pt-BR')}</td>
                <td>${app.masks.formatCurrency(sale.total)}</td>
                <td style="color: var(--success-color); font-weight: 500;">${isCanceled ? '---' : app.masks.formatCurrency(saleProfit)}</td>
                <td>
                    <button class="btn-icon" onclick="app.handlePrintSale(${sale.id})" title="Imprimir Recibo">🖨️</button>
                    ${isCanceled ? '' : `<button class="btn-icon" onclick="app.handleCancelSale(${sale.id})" title="Cancelar Venda">❌</button>`}
                </td>
            </tr>`
        }).join('');
        const paymentsHistory = db.load('payments').filter(p => p.clientId === clientId).sort((a,b) => b.id - a.id);
        const paymentsTableRows = paymentsHistory.map(p => `<tr><td>${new Date(p.date).toLocaleDateString('pt-BR')}</td><td>${app.masks.formatCurrency(p.amount)}</td><td>${p.method}</td></tr>`).join('');
        app.content.innerHTML = `
            <div class="card">
                 <button class="btn btn-secondary" onclick="app.renderClientes()">&larr; Voltar para a Lista</button>
                 <h2 style="margin-top: 1rem;">Ficha Financeira: ${client.name}</h2>
                 <p><strong>Telefone:</strong> ${client.phone}</p>
                 <h3>Saldo Devedor: <span style="font-size: 1.5rem; color: ${balance > 0 ? 'var(--danger-color)' : 'var(--success-color)'};">${app.masks.formatCurrency(balance)}</span></h3>
            </div>
            <div class="card"><h3>➕ Registrar Novo Pagamento</h3><form id="form-add-payment"><div class="form-group"><label for="payment-amount">Valor (R$)</label><input type="text" id="payment-amount" oninput="app.masks.currency(event)" required></div><div class="form-group"><label for="payment-method">Forma</label><select id="payment-method"><option>PIX</option><option>Dinheiro</option><option>Cartão</option></select></div><button type="submit" class="btn btn-success">Registrar</button></form></div>
            <div class="card"><h3>Histórico de Vendas</h3><table><thead><tr><th>Pedido</th><th>Data</th><th>Total</th><th>Lucro</th><th>Ação</th></tr></thead><tbody>${salesTableRows.length ? salesTableRows : '<tr><td colspan="5">Nenhuma venda registrada.</td></tr>'}</tbody></table></div>
            <div class="card"><h3>Histórico de Pagamentos</h3><table><thead><tr><th>Data</th><th>Valor</th><th>Forma</th></tr></thead><tbody>${paymentsTableRows.length ? paymentsTableRows : '<tr><td colspan="3">Nenhum pagamento registrado.</td></tr>'}</tbody></table></div>`;
        document.getElementById('form-add-payment').addEventListener('submit', (e) => app.handleSavePayment(e, clientId));
    },

    renderEncomendas: (filter = 'ativas') => {
        app.setActiveNav('nav-encomendas');
        let formHtml = `<div id="add-order-form-container" style="display:none;"><h2>➕ Nova Encomenda</h2><form id="form-add-encomenda">
            <div class="form-group" style="position: relative;">
                <label for="encomenda-cliente-search">Cliente</label>
                <div style="display:flex; gap: 5px;">
                    <input type="text" id="encomenda-cliente-search" placeholder="Buscar cliente..." required>
                    <button type="button" class="btn-icon btn-icon-add btn-success" onclick="app.handleQuickAddClient('encomendas')">➕</button>
                </div>
                <div id="encomenda-client-results" class="autocomplete-results"></div>
                <input type="hidden" id="encomenda-cliente-id">
            </div>
            <div class="form-group" style="position: relative;">
                <label for="encomenda-product-search">Produto</label>
                 <div style="display:flex; gap: 5px;">
                    <input type="text" id="encomenda-product-search" placeholder="Buscar produto..." required>
                    <button type="button" class="btn-icon btn-icon-add btn-success" onclick="app.handleQuickAddProduct('encomendas')">➕</button>
                </div>
                <div id="encomenda-product-results" class="autocomplete-results"></div>
                <input type="hidden" id="encomenda-produto-id">
            </div>
            <div class="form-group"><label for="encomenda-qtd">Quantidade</label><input type="number" id="encomenda-qtd" value="1" min="1" required></div>
            <button type="submit" class="btn btn-success">Registrar</button>
            <button type="button" class="btn btn-secondary" onclick="app.toggleForm('add-order-form-container', 'btn-show-add-order-form', false)">Cancelar</button>
        </form></div>`;
        
        let orders = db.load('orders');
        if (filter === 'ativas') { orders = orders.filter(o => o.status !== 'Cancelado'); }
        if (filter === 'canceladas') { orders = orders.filter(o => o.status === 'Cancelado'); }
        
        const clients = db.load('clients');
        const products = db.load('products');
        const tableRows = orders.sort((a, b) => b.id - a.id).map(order => {
            const client = clients.find(c => c.id === order.clientId);
            const product = products.find(p => p.id === order.productId);
            const statusOptions = ['Solicitado', 'Pedido Realizado', 'Chegou', 'Cancelado'].map(status => `<option value="${status}" ${order.status === status ? 'selected' : ''}>${status}</option>`).join('');
            return `<tr data-status="${order.status.replace(/ /g, '')}">
                        <td>${client ? client.name : 'N/D'}</td>
                        <td>${product ? `${product.name} (${product.cycle})` : 'N/D'}</td>
                        <td>${order.quantity}</td>
                        <td><select onchange="app.updateOrderStatus(${order.id}, this.value)">${statusOptions}</select></td>
                        <td>
                            <button class="btn-icon" onclick="app.convertOrderToSale(${order.id})" title="Gerar Venda" ${order.status !== 'Chegou' ? 'disabled' : ''}>🛒</button>
                            <button class="btn-icon" onclick="app.handleDeleteOrder(${order.id})" title="Excluir Permanentemente">🗑️</button>
                        </td>
                    </tr>`;
        }).join('');
        app.content.innerHTML = `
            <div class="card">${formHtml}</div>
            <div class="card">
                <div class="controls-header">
                    <h2>Lista de Encomendas</h2>
                     <button class="btn btn-primary" id="btn-show-add-order-form">➕ Nova Encomenda</button>
                    <div class="filter-group">
                        <select id="order-status-filter" onchange="app.renderEncomendas(this.value)">
                            <option value="ativas" ${filter === 'ativas' ? 'selected' : ''}>Ativas</option>
                            <option value="canceladas" ${filter === 'canceladas' ? 'selected' : ''}>Canceladas</option>
                            <option value="todas" ${filter === 'todas' ? 'selected' : ''}>Todas</option>
                        </select>
                    </div>
                </div>
                <table><thead><tr><th>Cliente</th><th>Produto</th><th>Qtd.</th><th>Status</th><th>Ações</th></tr></thead><tbody>${tableRows}</tbody></table>
            </div>`;
        
        const addOrderBtn = document.getElementById('btn-show-add-order-form');
        if(addOrderBtn) { addOrderBtn.addEventListener('click', () => app.toggleForm('add-order-form-container', 'btn-show-add-order-form', true)); }
        const addOrderForm = document.getElementById('form-add-encomenda');
        if (addOrderForm) {
            addOrderForm.addEventListener('submit', app.handleAddNewOrder);
            document.getElementById('encomenda-cliente-search').addEventListener('keyup', (e) => app.handleAutocomplete(e, 'clients', 'encomenda-client-results', 'encomenda-cliente-id', false, 'selectAutocompleteItem'));
            document.getElementById('encomenda-product-search').addEventListener('keyup', (e) => app.handleAutocomplete(e, 'products', 'encomenda-product-results', 'encomenda-produto-id', false, 'selectAutocompleteItem'));
        }
    },

    renderProdutos: () => {
        app.setActiveNav('nav-produtos');
        app.content.innerHTML = `
            <div class="card" id="product-form-wrapper"></div>
            <div class="card">
                <div class="controls-header">
                    <h2>Lista de Produtos</h2>
                    <button class="btn btn-primary" id="btn-show-add-product-form">➕ Adicionar Novo Produto</button>
                    <div class="filter-group">
                        <select id="product-status-filter"><option value="ativos">Ativos</option><option value="inativos">Inativos</option><option value="todos">Todos</option></select>
                        <select id="product-sort"><option value="az">A-Z</option><option value="za">Z-A</option></select>
                    </div>
                </div>
                <div class="form-group search-group">
                    <input type="text" id="search-product" placeholder="Buscar por nome, marca ou ciclo...">
                    <button class="btn btn-secondary" id="product-clear-search">Limpar</button>
                </div>
                <table id="products-table"><thead><tr><th>Nome</th><th>Marca</th><th>Ciclo</th><th>Preço Venda</th><th>Estoque</th><th>Ações</th></tr></thead><tbody></tbody></table>
            </div>`;

        app.showProductForm();
        app.updateProductList();

        document.getElementById('btn-show-add-product-form').addEventListener('click', () => app.toggleForm('add-product-form-container', 'btn-show-add-product-form', true));
        document.getElementById('product-status-filter').addEventListener('change', app.updateProductList);
        document.getElementById('product-sort').addEventListener('change', app.updateProductList);
        document.getElementById('search-product').addEventListener('keyup', app.updateProductList);
        document.getElementById('product-clear-search').addEventListener('click', () => {
            document.getElementById('search-product').value = '';
            app.updateProductList();
        });
    },
    
    renderReports: () => {
        app.setActiveNav('nav-reports');
        const clients = db.load('clients').filter(c => c.isActive && c.id !== 0);
        const clientOptions = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');

        app.content.innerHTML = `
            <div class="card">
                <h2>📈 Relatórios de Vendas</h2>
                <div class="filter-group" style="flex-wrap: wrap;">
                    <div class="form-group">
                        <label for="start-date">Data Início</label>
                        <input type="date" id="start-date">
                    </div>
                    <div class="form-group">
                        <label for="end-date">Data Fim</label>
                        <input type="date" id="end-date">
                    </div>
                    <div class="form-group">
                        <label for="client-filter">Cliente</label>
                        <select id="client-filter">
                            <option value="all">Todos os Clientes</option>
                            <option value="0">Apenas Vendas de Balcão</option>
                            ${clientOptions}
                        </select>
                    </div>
                    <button class="btn btn-primary" id="generate-report-btn" style="align-self: flex-end;">Gerar</button>
                </div>
            </div>
            <div id="report-results"></div>
        `;
        document.getElementById('generate-report-btn').addEventListener('click', app.handleGenerateReport);
    },
    
    renderSettings: () => {
        app.setActiveNav('nav-settings');
        const brands = db.load('brands');
        const companyData = db.load('company_data');

        const brandsHtml = brands.map(brand => {
            const actionButtons = brand.isActive
                ? `<button class="btn-icon" onclick="app.showEditBrandModal(${brand.id})" title="Editar">✏️</button> <button class="btn-icon" onclick="app.handleInactivateBrand(${brand.id})" title="Inativar">🚫</button>`
                : `<button class="btn-icon" onclick="app.handleReactivateBrand(${brand.id})" title="Reativar">✅</button>`;
            return `<div class="brand-item ${!brand.isActive ? 'inactive-row' : ''}"><span>${brand.name}</span><div>${actionButtons}</div></div>`;
        }).join('');

        app.content.innerHTML = `
            <div class="card"><h2>⚙️ Configurações</h2><p>Gerencie as configurações gerais do sistema.</p></div>
            <div class="card">
                <h3>Gerenciar Marcas</h3>
                <div class="brands-list">${brandsHtml}</div>
                <form id="form-add-brand" class="form-group" style="display: flex; gap: 10px; margin-top: 1rem;">
                    <input type="text" id="new-brand-name" placeholder="Nome da nova marca" required>
                    <button type="submit" class="btn btn-success">➕</button>
                </form>
            </div>
            <div class="card">
                <h3>Dados da Empresa e Recibo</h3>
                <form id="form-company-data">
                    <div class="form-group"><label>Nome da Loja</label><input type="text" id="company-name" value="${companyData.name || ''}"></div>
                    <div class="form-group"><label>CNPJ</label><input type="text" id="company-cnpj" value="${companyData.cnpj || ''}"></div>
                    <div class="form-group"><label>Endereço</label><input type="text" id="company-address" value="${companyData.address || ''}"></div>
                    <div class="form-group"><label>Cidade/UF</label><input type="text" id="company-city" value="${companyData.city || ''}"></div>
                    <div class="form-group"><label>CEP</label><input type="text" id="company-zip" value="${companyData.zip || ''}"></div>
                    <div class="form-group"><label>Telefone</label><input type="text" id="company-phone" value="${companyData.phone || ''}"></div>
                    <div class="form-group"><label>Mensagem do Recibo</label><textarea id="company-receipt-msg" rows="3">${companyData.receiptMessage || ''}</textarea></div>
                    <button type="submit" class="btn btn-primary">Salvar Dados</button>
                </form>
            </div>
            <div class="card">
                <h3>Ferramentas de Backup</h3>
                <button class="btn btn-primary" id="export-backup">📤 Exportar Backup</button>
                <label for="import-backup" class="btn btn-secondary" style="cursor: pointer;">📥 Importar Backup</label>
                <input type="file" id="import-backup" accept=".json" style="display:none;">
            </div>
        `;

        document.getElementById('export-backup').addEventListener('click', app.handleExportData);
        document.getElementById('import-backup').addEventListener('change', app.handleImportData);
        document.getElementById('form-add-brand').addEventListener('submit', app.handleAddNewBrand);
        document.getElementById('form-company-data').addEventListener('submit', app.handleSaveCompanyData);
    },

    // ----- LÓGICA E MANIPULADORES DE EVENTO -----
    
    updateClientList: () => {
        const statusFilter = document.getElementById('client-status-filter').value;
        const sort = document.getElementById('client-sort').value;
        const searchTerm = document.getElementById('client-search').value.toLowerCase();
        
        let clients = db.load('clients').filter(c => c.id !== 0);

        if (statusFilter === 'ativos') clients = clients.filter(c => c.isActive);
        if (statusFilter === 'inativos') clients = clients.filter(c => !c.isActive);
        
        if (searchTerm) {
            const numericSearchTerm = searchTerm.replace(/\D/g, '');
            clients = clients.filter(c => {
                const nameMatch = c.name.toLowerCase().includes(searchTerm);
                let phoneMatch = false;
                if (numericSearchTerm.length > 0) {
                    phoneMatch = (c.phone || '').replace(/\D/g, '').includes(numericSearchTerm);
                }
                return nameMatch || phoneMatch;
            });
        }

        clients.sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

        const tableRows = clients.map(client => {
            const balance = app.calculateClientBalance(client.id);
            const phoneDigits = (client.phone || '').replace(/\D/g, '');
            const actionButtons = client.isActive
                ? `<a class="btn-icon" href="https://wa.me/55${phoneDigits}" target="_blank" title="WhatsApp">💬</a> <button class="btn-icon" onclick="app.showEditClientForm(${client.id})" title="Editar">✏️</button> <button class="btn-icon" onclick="app.renderClientDetail(${client.id})" title="Ver Detalhes">👁️</button> <button class="btn-icon" onclick="app.handleInactivateClient(${client.id})" title="Inativar">🚫</button>`
                : `<button class="btn-icon" onclick="app.handleReactivateClient(${client.id})" title="Reativar">✅</button>`;
            return `<tr class="${!client.isActive ? 'inactive-row' : ''}"><td>${client.name}</td><td>${client.phone}</td><td style="font-weight: bold; color: ${balance > 0 ? 'var(--danger-color)' : 'black'};">${app.masks.formatCurrency(balance)}</td><td>${actionButtons}</td></tr>`;
        }).join('');
        const tableBody = document.querySelector('#clients-table tbody');
        if(tableBody) tableBody.innerHTML = tableRows;
    },
    
    showClientForm: () => {
        const wrapper = document.getElementById('client-form-wrapper');
        if(!wrapper) return;
        const clientToEdit = app.editingClientId ? db.load('clients').find(c => c.id === app.editingClientId) : null;

        if (clientToEdit) {
            wrapper.innerHTML = `<div id="edit-client-form-container"><h2>✏️ Editando Cliente: ${clientToEdit.name}</h2><form id="form-edit-cliente"><div class="form-group"><label>Nome</label><input type="text" id="client-name" value="${clientToEdit.name}" required></div><div class="form-group"><label>Telefone</label><input type="text" id="client-phone" value="${clientToEdit.phone || ''}" oninput="app.masks.phone(event)"></div><div class="form-group"><label>E-mail</label><input type="email" id="client-email" value="${clientToEdit.email || ''}"></div><button type="submit" class="btn btn-success">Salvar</button> <button type="button" class="btn btn-secondary" onclick="app.cancelEditClient()">Cancelar</button></form></div>`;
            document.getElementById('btn-show-add-client-form').style.display = 'none';
            document.getElementById('form-edit-cliente').addEventListener('submit', (e) => app.handleUpdateClient(e, clientToEdit.id));
        } else {
            const cancelJs = `app.toggleForm('add-client-form-container', 'btn-show-add-client-form', false); document.getElementById('btn-show-add-client-form').focus();`;
            wrapper.innerHTML = `<div id="add-client-form-container" style="display:none;"><h2>➕ Adicionar Novo Cliente</h2><form id="form-add-cliente"><div class="form-group"><label>Nome</label><input type="text" id="client-name" required></div><div class="form-group"><label>Telefone</label><input type="text" id="client-phone" placeholder="(XX) X XXXX-XXXX" oninput="app.masks.phone(event)"></div><div class="form-group"><label>E-mail</label><input type="email" id="client-email" placeholder="cliente@email.com"></div><button type="submit" class="btn btn-success">Adicionar</button> <button type="button" class="btn btn-secondary" onclick="${cancelJs}">Cancelar</button></form></div>`;
            const addClientForm = document.getElementById('form-add-cliente');
            if (addClientForm) addClientForm.addEventListener('submit', app.handleAddNewClient);
        }
    },
    handleAddNewClient: (event) => { event.preventDefault(); const clients = db.load('clients'); clients.push({ id: Date.now(), name: document.getElementById('client-name').value, phone: document.getElementById('client-phone').value, email: document.getElementById('client-email').value, isActive: true }); db.save('clients', clients); app.ui.showToast('Cliente adicionado!'); app.renderClientes(); },
    showEditClientForm: (clientId) => { app.editingClientId = clientId; app.renderClientes(); },
    cancelEditClient: () => { app.editingClientId = null; app.renderClientes(); },
    handleUpdateClient: (event, clientId) => { event.preventDefault(); const clients = db.load('clients'); const client = clients.find(c => c.id === clientId); if (client) { client.name = document.getElementById('client-name').value; client.phone = document.getElementById('client-phone').value; client.email = document.getElementById('client-email').value; db.save('clients', clients); app.editingClientId = null; app.ui.showToast('Cliente atualizado!'); app.renderClientes(); } },
    handleInactivateClient: (clientId) => { app.ui.showConfirmation('Deseja inativar este cliente?', () => { const clients = db.load('clients'); const client = clients.find(c => c.id === clientId); if (client) { client.isActive = false; db.save('clients', clients); app.ui.showToast('Cliente inativado.'); app.updateClientList(); } }); },
    handleReactivateClient: (clientId) => { const clients = db.load('clients'); const client = clients.find(c => c.id === clientId); if(client) { client.isActive = true; db.save('clients', clients); app.ui.showToast('Cliente reativado!'); app.renderClientes(); } },
    
    updateProductList: () => {
        const filter = document.getElementById('product-status-filter').value;
        const sort = document.getElementById('product-sort').value;
        const searchTerm = document.getElementById('search-product').value.toLowerCase();
        
        let products = db.load('products');
        if (filter === 'ativos') products = products.filter(p => p.isActive);
        if (filter === 'inativos') products = products.filter(p => !p.isActive);

        if(searchTerm){
            products = products.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.brand || '').toLowerCase().includes(searchTerm) || (p.cycle || '').toLowerCase().includes(searchTerm));
        }
        products.sort((a, b) => sort === 'az' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
        const tableRows = products.map(product => {
            const actionButtons = product.isActive
                ? `<button class="btn-icon" onclick="app.showEditProductForm(${product.id})" title="Editar">✏️</button> <button class="btn-icon" onclick="app.handleInactivateProduct(${product.id})" title="Inativar">🚫</button>`
                : `<button class="btn-icon" onclick="app.handleReactivateProduct(${product.id})" title="Reativar">✅</button>`;
            return `<tr class="${!product.isActive ? 'inactive-row' : ''}"><td>${product.name}</td><td>${product.brand}</td><td>${product.cycle}</td><td>${app.masks.formatCurrency(product.salePrice)}</td><td>${product.stock}</td><td>${actionButtons}</td></tr>`
        }).join('');
        const tableBody = document.querySelector("#products-table tbody");
        if(tableBody) tableBody.innerHTML = tableRows;
    },
    showProductForm: () => {
        const wrapper = document.getElementById('product-form-wrapper');
        if(!wrapper) return;
        const productToEdit = app.editingProductId ? db.load('products').find(p => p.id === app.editingProductId) : null;
        const brands = db.load('brands').filter(b => b.isActive);
        const brandOptions = brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('') + `<option value="--add-new--">Adicionar nova marca...</option>`;

        if (productToEdit) {
            const editBrandOptions = brands.map(b => `<option value="${b.name}" ${productToEdit.brand === b.name ? 'selected':''}>${b.name}</option>`).join('');
            wrapper.innerHTML = `<div id="edit-product-form-container"><h2>✏️ Editando Produto</h2><form id="form-edit-produto">
                <div class="form-group"><label>Nome</label><input type="text" id="prod-name" value="${productToEdit.name}" required></div>
                <div class="form-group"><label>Marca</label><select id="prod-brand">${editBrandOptions}</select></div>
                <div class="form-group"><label>Ciclo/Campanha</label><input type="text" id="prod-cycle" value="${productToEdit.cycle}" required></div>
                <div class="form-group"><label>Preço Custo (R$)</label><input type="text" id="prod-cost" value="${app.masks.formatCurrency(productToEdit.costPrice)}" oninput="app.masks.currency(event)" required></div>
                <div class="form-group"><label>Preço Venda (R$)</label><input type="text" id="prod-sale" value="${app.masks.formatCurrency(productToEdit.salePrice)}" oninput="app.masks.currency(event)" required></div>
                <div class="form-group"><label>Estoque</label><input type="number" id="prod-stock" value="${productToEdit.stock}" min="0" required></div>
                <button type="submit" class="btn btn-success">Salvar</button> <button type="button" class="btn btn-secondary" onclick="app.cancelEditProduct()">Cancelar</button>
            </form></div>`;
            document.getElementById('btn-show-add-product-form').style.display = 'none';
            document.getElementById('form-edit-produto').addEventListener('submit', (e) => app.handleUpdateProduct(e, productToEdit.id));
        } else {
            wrapper.innerHTML = `<div id="add-product-form-container" style="display:none;"><h2>➕ Adicionar Novo Produto</h2><form id="form-add-produto">
                <div class="form-group"><label>Nome</label><input type="text" id="prod-name" required></div>
                <div class="form-group"><label>Marca</label><select id="prod-brand">${brandOptions}</select></div>
                <div class="form-group"><label>Ciclo/Campanha</label><input type="text" id="prod-cycle" required></div>
                <div class="form-group"><label>Preço Custo (R$)</label><input type="text" id="prod-cost" placeholder="R$ 0,00" oninput="app.masks.currency(event)" required></div>
                <div class="form-group"><label>Preço Venda (R$)</label><input type="text" id="prod-sale" placeholder="R$ 0,00" oninput="app.masks.currency(event)" required></div>
                <div class="form-group"><label>Estoque Inicial</label><input type="number" id="prod-stock" value="0" min="0" required></div>
                <button type="submit" class="btn btn-success">Adicionar</button> <button type="button" class="btn btn-secondary" onclick="app.toggleForm('add-product-form-container', 'btn-show-add-product-form', false)">Cancelar</button>
            </form></div>`;
            const addProductForm = document.getElementById('form-add-produto');
            if (addProductForm) { addProductForm.addEventListener('submit', app.handleAddNewProduct); document.getElementById('prod-brand').addEventListener('change', app.handleBrandChange); }
        }
    },
    handleAddNewProduct: (event) => { event.preventDefault(); const newProduct = { id: Date.now(), name: document.getElementById('prod-name').value, brand: document.getElementById('prod-brand').value, cycle: document.getElementById('prod-cycle').value, costPrice: app.masks.unformatCurrency(document.getElementById('prod-cost').value), salePrice: app.masks.unformatCurrency(document.getElementById('prod-sale').value), stock: parseInt(document.getElementById('prod-stock').value), isActive: true }; const products = db.load('products'); products.push(newProduct); db.save('products', products); app.ui.showToast('Produto adicionado!'); app.renderProdutos(); },
    showEditProductForm: (productId) => { app.editingProductId = productId; app.renderProdutos(); },
    cancelEditProduct: () => { app.editingProductId = null; app.renderProdutos(); },
    handleUpdateProduct: (event, productId) => { event.preventDefault(); const products = db.load('products'); const product = products.find(p => p.id === productId); if(product) { product.name = document.getElementById('prod-name').value; product.brand = document.getElementById('prod-brand').value; product.cycle = document.getElementById('prod-cycle').value; product.costPrice = app.masks.unformatCurrency(document.getElementById('prod-cost').value); product.salePrice = app.masks.unformatCurrency(document.getElementById('prod-sale').value); product.stock = parseInt(document.getElementById('prod-stock').value); db.save('products', products); app.editingProductId = null; app.ui.showToast('Produto atualizado!'); app.renderProdutos(); } },
    handleInactivateProduct: (productId) => { app.ui.showConfirmation('Deseja inativar este produto?', () => { const products = db.load('products'); const product = products.find(p => p.id === productId); if (product) { product.isActive = false; db.save('products', products); app.ui.showToast('Produto inativado.'); app.updateProductList(); } }); },
    handleReactivateProduct: (productId) => { const products = db.load('products'); const product = products.find(p => p.id === productId); if (product) { product.isActive = true; db.save('products', products); app.ui.showToast('Produto reativado!'); app.renderProdutos(); } },
    handleBrandChange: (event) => { if (event.target.value === '--add-new--') { const newBrand = prompt("Digite o nome da nova marca:"); if (newBrand && newBrand.trim() !== "") { let brands = db.load('brands'); if (!brands.find(b => b.name.toLowerCase() === newBrand.toLowerCase())) { brands.push({ id: Date.now(), name: newBrand, isActive: true }); db.save('brands', brands); app.renderProdutos(); app.ui.showToast('Nova marca adicionada!'); } } else { event.target.value = db.load('brands').find(b => b.isActive)?.name || ""; } } },
    handleAddNewBrand: (event) => { event.preventDefault(); const newBrandName = document.getElementById('new-brand-name').value; if(newBrandName && newBrandName.trim() !== ""){ let brands = db.load('brands'); if (!brands.find(b => b.name.toLowerCase() === newBrandName.toLowerCase())) { brands.push({ id: Date.now(), name: newBrandName, isActive: true }); db.save('brands', brands); app.renderSettings(); app.ui.showToast('Nova marca adicionada!'); } else { app.ui.showToast('Esta marca já existe.', 'error'); } } document.getElementById('new-brand-name').value = ''; },
    showEditBrandModal: (brandId) => {
        const brand = db.load('brands').find(b => b.id === brandId);
        if (!brand) return;
        const content = `<div class="modal-content">
            <h2>✏️ Editando Marca</h2>
            <form id="form-edit-brand">
                <div class="form-group">
                    <label for="edit-brand-name">Nome da Marca</label>
                    <input type="text" id="edit-brand-name" value="${brand.name}" required>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="btn btn-success">Salvar</button>
                    <button type="button" class="btn btn-secondary" onclick="app.ui.closeModal()">Cancelar</button>
                </div>
            </form>
        </div>`;
        app.ui.showModal(content);
        document.getElementById('form-edit-brand').addEventListener('submit', (e) => {
            e.preventDefault();
            const newName = document.getElementById('edit-brand-name').value;
            app.handleUpdateBrand(brandId, newName);
        });
    },
    handleUpdateBrand: (brandId, newName) => { let brands = db.load('brands'); const brand = brands.find(b => b.id === brandId); if (brand && newName && newName.trim() !== "") { brand.name = newName.trim(); db.save('brands', brands); app.ui.showToast('Marca atualizada!'); app.renderSettings(); } app.ui.closeModal(); },
    handleInactivateBrand: (brandId) => { app.ui.showConfirmation(`Deseja inativar esta marca? Ela não aparecerá mais para novos produtos.`, () => { let brands = db.load('brands'); const brand = brands.find(b => b.id === brandId); if(brand){ brand.isActive = false; db.save('brands', brands); app.renderSettings(); } }); },
    handleReactivateBrand: (brandId) => { let brands = db.load('brands'); const brand = brands.find(b => b.id === brandId); if (brand) { brand.isActive = true; db.save('brands', brands); app.renderSettings(); } },
    handleSaveCompanyData: (event) => { event.preventDefault(); const companyData = { name: document.getElementById('company-name').value, cnpj: document.getElementById('company-cnpj').value, address: document.getElementById('company-address').value, city: document.getElementById('company-city').value, zip: document.getElementById('company-zip').value, phone: document.getElementById('company-phone').value, receiptMessage: document.getElementById('company-receipt-msg').value }; db.save('company_data', companyData); app.ui.showToast('Dados da empresa salvos!'); },

    handleAddNewOrder: (event) => { event.preventDefault(); const clientId = document.getElementById('encomenda-cliente-id').value; const productId = document.getElementById('encomenda-produto-id').value; if (!clientId || !productId) { app.ui.showToast('Cliente e produto devem ser selecionados da lista.', 'error'); return; } const newOrder = { id: Date.now(), clientId: parseInt(clientId), productId: parseInt(productId), quantity: parseInt(document.getElementById('encomenda-qtd').value), status: 'Solicitado', requestDate: new Date().toISOString() }; const orders = db.load('orders'); orders.push(newOrder); db.save('orders', orders); app.ui.showToast('Encomenda registrada!'); app.renderEncomendas(); document.getElementById('btn-show-add-order-form').focus(); },
    updateOrderStatus: (orderId, newStatus) => { const orders = db.load('orders'); const order = orders.find(o => o.id === orderId); if (order) { order.status = newStatus; db.save('orders', orders); app.renderEncomendas(document.getElementById('order-status-filter')?.value); } },
    handleDeleteOrder: (orderId) => { app.ui.showConfirmation('Deseja EXCLUIR PERMANENTEMENTE esta encomenda?', () => { let orders = db.load('orders'); orders = orders.filter(o => o.id !== orderId); db.save('orders', orders); app.ui.showToast('Encomenda excluída.'); app.renderEncomendas(document.getElementById('order-status-filter')?.value); }); },
    convertOrderToSale: (orderId) => { const order = db.load('orders').find(o => o.id === orderId); if (order) { const updatedOrders = db.load('orders').filter(o => o.id !== orderId); db.save('orders', updatedOrders); app.renderVendas(order); } },
    
    handleAutocomplete: (event, dataType, resultsId, hiddenIdOrNull, isPdv = false, clickHandlerName) => {
        const searchTerm = event.target.value.toLowerCase();
        const resultsContainer = document.getElementById(resultsId);
        if (!resultsContainer) return;
        
        let allData = db.load(dataType).filter(i => i.isActive);
        let filteredData = [];

        if (dataType === 'clients') {
            if (searchTerm.length > 0) {
                const numericSearchTerm = searchTerm.replace(/\D/g, '');
                filteredData = allData.filter(i => {
                    if (i.id === 0) return false;
                    const nameMatch = i.name.toLowerCase().includes(searchTerm);
                    let phoneMatch = false;
                    if (numericSearchTerm.length > 0) {
                        phoneMatch = (i.phone || '').replace(/\D/g, '').includes(numericSearchTerm);
                    }
                    return nameMatch || phoneMatch;
                });
            } else if (isPdv) {
                filteredData = [allData.find(c => c.id === 0)].filter(Boolean);
            }
        } else { 
            if (searchTerm.length > 0) {
                filteredData = allData.filter(i => i.name.toLowerCase().includes(searchTerm) || (i.brand || '').toLowerCase().includes(searchTerm) || (i.cycle || '').toLowerCase().includes(searchTerm));
            }
        }
        
        resultsContainer.innerHTML = filteredData.map(i => {
            const displayName = i.cycle ? `${i.name} <small>(${i.cycle})</small>` : i.name;
            let finalClickHandler;
            if (isPdv) {
                finalClickHandler = `app.${clickHandlerName}(${i.id})`;
            } else {
                finalClickHandler = `app.selectAutocompleteItem('${i.name.replace(/'/g, "\\'")}', ${i.id}, '${resultsId}', '${hiddenIdOrNull}', '${event.target.id}')`;
            }
            return `<div class="autocomplete-item" onclick="${finalClickHandler}">${displayName}</div>`;
        }).join('');

        if (searchTerm.length === 0 && !isPdv) {
             resultsContainer.innerHTML = '';
        }
    },
    
    selectClientForSale: (clientId) => { 
        app.currentSaleClient = db.load('clients').find(c => c.id === clientId); 
        if(app.currentSaleClient) { 
            document.getElementById('pdv-client-area').style.display = 'none'; 
            const selectedClientDiv = document.getElementById('pdv-selected-client'); 
            selectedClientDiv.style.display = 'block'; 
            document.getElementById('selected-client-name').textContent = app.currentSaleClient.name; 
            document.getElementById('pdv-client-results').innerHTML = ''; 
            document.getElementById('change-client-btn').onclick = () => { 
                app.currentSaleClient = null; 
                document.getElementById('pdv-client-area').style.display = 'block'; 
                selectedClientDiv.style.display = 'none'; 
                const searchInput = document.getElementById('pdv-client-search'); 
                searchInput.value = ''; 
                searchInput.focus(); 
                searchInput.dispatchEvent(new Event('keyup'));
                document.getElementById('btn-finalizar-prazo').style.display = 'none';
            }; 
            document.getElementById('pdv-product-search').focus(); 
            
            const prazoBtn = document.getElementById('btn-finalizar-prazo');
            if (clientId !== 0) {
                prazoBtn.style.display = 'block';
                prazoBtn.textContent = `Finalizar a Prazo (para ${app.currentSaleClient.name})`;
            } else {
                prazoBtn.style.display = 'none';
            }
        } 
    },

    selectProductForSale: (productId, quantity = 1) => { const product = db.load('products').find(p => p.id === productId); if(!product) return; const currentQtyInCart = app.currentSaleItems.filter(i => i.productId === productId).reduce((sum, i) => sum + i.quantity, 0); if(product.stock < (quantity + currentQtyInCart)) { app.ui.showToast(`Estoque insuficiente para ${product.name}. Disponível: ${product.stock - currentQtyInCart}`, 'error'); return; } const item = { itemId: Date.now(), productId: product.id, name: product.name, cycle: product.cycle, quantity, unitPrice: product.salePrice, costPrice: product.costPrice, total: quantity * product.salePrice }; app.currentSaleItems.push(item); app.updateSaleCartView(); const searchInput = document.getElementById('pdv-product-search'); searchInput.value = ''; document.getElementById('pdv-product-results').innerHTML = ''; searchInput.focus(); },
    handleQuickAddClient: (origin = 'pdv') => { const content = `<div class="modal-content"><h2>➕ Adicionar Novo Cliente</h2><form id="form-quick-add-client"><div class="form-group"><label for="quick-client-name">Nome</label><input type="text" id="quick-client-name" required></div><div class="form-group"><label for="quick-client-phone">Telefone</label><input type="text" id="quick-client-phone" oninput="app.masks.phone(event)"></div><div class="form-group"><label for="quick-client-email">E-mail</label><input type="email" id="quick-client-email"></div><div class="modal-actions"><button type="submit" class="btn btn-success">Salvar e Selecionar</button> <button type="button" class="btn btn-secondary" onclick="app.ui.closeModal()">Cancelar</button></div></form></div>`; app.ui.showModal(content); document.getElementById('form-quick-add-client').addEventListener('submit', (e) => { e.preventDefault(); const clients = db.load('clients'); const newClient = { id: Date.now(), name: document.getElementById('quick-client-name').value, phone: document.getElementById('quick-client-phone').value, email: document.getElementById('quick-client-email').value, isActive: true }; clients.push(newClient); db.save('clients', clients); app.ui.showToast('Cliente adicionado!'); app.ui.closeModal(); if(origin === 'pdv'){ app.selectClientForSale(newClient.id); } else { app.selectAutocompleteItem(newClient.name, newClient.id, 'encomenda-client-results', 'encomenda-cliente-id', 'encomenda-cliente-search'); document.getElementById('encomenda-product-search').focus(); } }); },
    handleQuickAddProduct: (origin = 'encomendas') => { const brands = db.load('brands').filter(b => b.isActive); const brandOptions = brands.map(b => `<option value="${b.name}">${b.name}</option>`).join('') + `<option value="--add-new--">Adicionar nova marca...</option>`; const content = `<div class="modal-content"><h2>➕ Adicionar Novo Produto</h2><form id="form-quick-add-product"><div class="form-group"><label>Nome</label><input type="text" id="quick-prod-name" required></div><div class="form-group"><label>Marca</label><select id="quick-prod-brand">${brandOptions}</select></div><div class="form-group"><label>Ciclo/Campanha</label><input type="text" id="quick-prod-cycle" required></div><div class="form-group"><label>Preço Venda (R$)</label><input type="text" id="quick-prod-sale" placeholder="R$ 0,00" oninput="app.masks.currency(event)" required></div><div class="form-group"><label>Estoque Inicial</label><input type="number" id="quick-prod-stock" value="0" required></div><div class="modal-actions"><button type="submit" class="btn btn-success">Salvar e Selecionar</button><button type="button" class="btn btn-secondary" onclick="app.ui.closeModal()">Cancelar</button></div></form></div>`; app.ui.showModal(content); document.getElementById('form-quick-add-product').addEventListener('submit', (e) => { e.preventDefault(); const newProduct = { id: Date.now(), name: document.getElementById('quick-prod-name').value, brand: document.getElementById('quick-prod-brand').value, cycle: document.getElementById('quick-prod-cycle').value, salePrice: app.masks.unformatCurrency(document.getElementById('quick-prod-sale').value), costPrice: 0, stock: parseInt(document.getElementById('quick-prod-stock').value) || 0, isActive: true }; const products = db.load('products'); products.push(newProduct); db.save('products', products); app.ui.showToast('Produto adicionado!'); app.ui.closeModal(); if(origin === 'encomendas'){ app.selectAutocompleteItem(newProduct.name, newProduct.id, 'encomenda-product-results', 'encomenda-produto-id', 'encomenda-product-search'); } }); },
    
    updateSaleCartView: () => { const container = document.getElementById('pdv-cart-items'); const totalEl = document.getElementById('pdv-total'); let subtotal = app.currentSaleItems.reduce((sum, item) => sum + item.total, 0); let discountValue = app.calculateDiscountValue(subtotal, app.currentDiscount); const finalTotal = subtotal - discountValue; if (app.currentSaleItems.length === 0) { container.innerHTML = `<p>Carrinho vazio.</p>`; } else { const itemsHtml = app.currentSaleItems.map(item => `<div class="pdv-cart-item"><div><p style="font-weight: 500;">${item.name} <small>(${item.cycle})</small></p><p><input type="number" value="${item.quantity}" min="1" onchange="app.updateItemQuantity(${item.itemId}, this.value)" style="width: 60px; padding: 5px;"> x <input type="text" value="${app.masks.formatCurrency(item.unitPrice)}" onchange="app.updateItemPrice(${item.itemId}, this.value)" style="width: 100px; padding: 5px;" oninput="app.masks.currency(event)"></p></div><div><p style="font-weight: bold;">${app.masks.formatCurrency(item.total)}</p></div><button class="btn-icon" onclick="app.removeItemFromSale(${item.itemId})" title="Remover Item">➖</button></div>`).join(''); container.innerHTML = itemsHtml; } const discountContainer = document.getElementById('pdv-discount-area'); if(discountValue > 0) { discountContainer.innerHTML = `<span>Desconto (${app.currentDiscount.value}${app.currentDiscount.type}):</span><div style="display:flex; align-items-center; gap:5px;"><strong>-${app.masks.formatCurrency(discountValue)}</strong> <button class="btn-icon" onclick="app.removeDiscount()" title="Remover Desconto">➖</button></div>`; discountContainer.style.display = 'flex'; } else { discountContainer.style.display = 'none'; } totalEl.textContent = `Total: ${app.masks.formatCurrency(finalTotal)}`; },
    updateItemQuantity: (itemId, newQuantity) => { const item = app.currentSaleItems.find(i => i.itemId === itemId); if(item) { const product = db.load('products').find(p => p.id === item.productId); const othersInCart = app.currentSaleItems.filter(i => i.productId === item.productId && i.itemId !== itemId).reduce((sum,i) => sum + i.quantity, 0); if (product.stock < (parseInt(newQuantity) + othersInCart)) { app.ui.showToast(`Estoque insuficiente. Disponível: ${product.stock - othersInCart}`, 'error'); app.updateSaleCartView(); return; } item.quantity = parseInt(newQuantity) || 1; item.total = item.quantity * item.unitPrice; app.updateSaleCartView(); } },
    updateItemPrice: (itemId, newPriceString) => { const item = app.currentSaleItems.find(i => i.itemId === itemId); if(item) { item.unitPrice = app.masks.unformatCurrency(newPriceString) || 0; item.total = item.quantity * item.unitPrice; app.updateSaleCartView(); } },
    removeItemFromSale: (itemId) => { app.currentSaleItems = app.currentSaleItems.filter(item => item.itemId !== itemId); app.updateSaleCartView(); },
    removeDiscount: () => { app.currentDiscount = { type: 'R$', value: 0 }; app.updateSaleCartView(); app.ui.showToast('Desconto removido.'); },
    showDiscountModal: () => { const content = `<div class="modal-content"><h2>% Aplicar Desconto</h2><form id="form-discount"><div class="form-group"><label>Tipo</label><select id="discount-type"><option value="R$" ${app.currentDiscount.type === 'R$' ? 'selected' : ''}>Valor Fixo (R$)</option><option value="%" ${app.currentDiscount.type === '%' ? 'selected' : ''}>Porcentagem (%)</option></select></div><div class="form-group"><label>Valor</label><input type="text" id="discount-value" value="${app.currentDiscount.value > 0 ? (app.currentDiscount.type === 'R$' ? app.currentDiscount.value.toFixed(2).replace('.',',') : app.currentDiscount.value) : ''}"></div><div class="modal-actions"><button type="submit" class="btn btn-success">Aplicar</button><button type="button" class="btn btn-secondary" onclick="app.ui.closeModal()">Cancelar</button></div></form></div>`; app.ui.showModal(content); const discountValueInput = document.getElementById('discount-value'); const discountTypeSelect = document.getElementById('discount-type'); const updateMask = () => { if (discountTypeSelect.value === 'R$') { discountValueInput.oninput = app.masks.currency; discountValueInput.type = 'text'; discountValueInput.removeAttribute('max'); } else { discountValueInput.oninput = null; discountValueInput.type = 'number'; discountValueInput.max = 100; } if (app.currentDiscount.type !== discountTypeSelect.value) discountValueInput.value = ''; }; updateMask(); discountTypeSelect.onchange = updateMask; document.getElementById('form-discount').addEventListener('submit', (e) => { e.preventDefault(); app.currentDiscount.type = document.getElementById('discount-type').value; let value = document.getElementById('discount-value').value; app.currentDiscount.value = app.currentDiscount.type === 'R$' ? app.masks.unformatCurrency(value) : parseFloat(value) || 0; app.updateSaleCartView(); app.ui.closeModal(); }); },
    
    handleFinalizeSale: (type) => {
        if (!app.currentSaleClient) { app.ui.showToast('Selecione um cliente para a venda.', 'error'); return; } 
        if (app.currentSaleItems.length === 0) { app.ui.showToast('Adicione pelo menos um produto à venda.', 'error'); return; }
        
        const products = db.load('products');
        for(const item of app.currentSaleItems){ const productInDb = products.find(p => p.id === item.productId); if(productInDb.stock < item.quantity){ app.ui.showToast(`Estoque de ${item.name} insuficiente. Apenas ${productInDb.stock} disponíveis.`, 'error'); return; } }

        const sales = db.load('sales'); 
        let saleCounter = db.load('sale_counter'); 
        if (typeof saleCounter !== 'number') saleCounter = 1000;
        const newOrderNumber = saleCounter + 1; 
        let subtotal = app.currentSaleItems.reduce((sum, item) => sum + item.total, 0);
        const newSale = { id: Date.now(), orderNumber: newOrderNumber, clientId: app.currentSaleClient.id, items: app.currentSaleItems, subtotal: subtotal, discount: {...app.currentDiscount}, total: subtotal - app.calculateDiscountValue(subtotal, app.currentDiscount), date: new Date().toISOString(), status: 'Finalizada' };

        sales.push(newSale); 
        db.save('sales', sales); 
        db.save('sale_counter', newOrderNumber); 
        newSale.items.forEach(item => { const product = products.find(p => p.id === item.productId); if (product) { product.stock -= item.quantity; } }); 
        db.save('products', products);

        if (type === 'vista') {
            app.showAdvancedPaymentModal(newSale);
        } else { // 'prazo'
            app.ui.showConfirmation(`Venda a prazo #${newOrderNumber} registrada! Deseja imprimir o recibo?`,
                () => {
                    const printWindow = app.handlePrintSale(newSale.id);
                    if (printWindow) {
                        const checkPrintWindow = setInterval(() => {
                            if (printWindow.closed) {
                                clearInterval(checkPrintWindow);
                                window.focus();
                                app.renderClientDetail(newSale.clientId);
                            }
                        }, 500);
                    } else {
                        app.renderClientDetail(newSale.clientId);
                    }
                },
                () => { app.renderClientDetail(newSale.clientId); }
            );
        }
    },
    
    showAdvancedPaymentModal: (sale) => {
        const content = `<div class="modal-content">
            <h2>Pagamento à Vista</h2>
            <div class="payment-modal-details">
                <span>Total da Compra:</span>
                <strong>${app.masks.formatCurrency(sale.total)}</strong>
            </div>
            <div class="form-group">
                <label for="amount-received">Valor Recebido (R$)</label>
                <input type="text" id="amount-received" oninput="app.masks.currency(event); app.calculateChange(${sale.total})">
            </div>
            <div class="payment-modal-change">
                <span>Troco:</span>
                <strong id="change-value">R$ 0,00</strong>
            </div>
            <div id="payment-actions" class="modal-actions" style="flex-direction: column; gap: 10px; margin-top: 1.5rem;">
                <button id="btn-confirm-payment-cash" class="btn btn-primary" disabled>Finalizar e Devolver Troco</button>
                <button id="btn-confirm-payment-pix" class="btn btn-success">Finalizar (PIX / Cartão)</button>
                <button id="btn-convert-change" class="btn btn-warning" style="display: none;">Finalizar e Converter Troco em Crédito</button>
            </div>
        </div>`;
        app.ui.showModal(content);
        
        document.getElementById('btn-confirm-payment-pix').onclick = () => app.processAdvancedPayment(sale, sale.total, false);
        document.getElementById('btn-confirm-payment-cash').onclick = () => {
            const amountReceived = app.masks.unformatCurrency(document.getElementById('amount-received').value);
            app.processAdvancedPayment(sale, amountReceived, false);
        };
        document.getElementById('btn-convert-change').onclick = () => {
            const amountReceived = app.masks.unformatCurrency(document.getElementById('amount-received').value);
            app.processAdvancedPayment(sale, amountReceived, true);
        };
    },

    calculateChange: (total) => {
        const amountReceivedInput = document.getElementById('amount-received');
        const amountReceived = app.masks.unformatCurrency(amountReceivedInput.value);
        const changeValueEl = document.getElementById('change-value');
        const confirmCashBtn = document.getElementById('btn-confirm-payment-cash');
        const convertChangeBtn = document.getElementById('btn-convert-change');

        let change = amountReceived - total;
        if (amountReceived < total || !amountReceived) {
            change = 0;
            confirmCashBtn.disabled = true;
            convertChangeBtn.style.display = 'none';
        } else {
            confirmCashBtn.disabled = false;
            if (change > 0 && app.currentSaleClient && app.currentSaleClient.id !== 0) {
                convertChangeBtn.style.display = 'block';
            } else {
                convertChangeBtn.style.display = 'none';
            }
        }
        changeValueEl.textContent = app.masks.formatCurrency(change);
    },

    processAdvancedPayment: (sale, amountPaid, convertChange) => {
        const paymentAmount = convertChange ? amountPaid : sale.total;
        
        if (sale.clientId !== null) {
            const payments = db.load('payments');
            payments.push({ id: Date.now(), clientId: sale.clientId, amount: paymentAmount, method: 'À Vista', date: new Date().toISOString() });
            db.save('payments', payments);
        }
        app.ui.closeModal();

        const finalAction = () => {
            let toastMessage = `Venda #${sale.orderNumber} finalizada!`;
            if (convertChange && (amountPaid - sale.total > 0)) {
                toastMessage += ` Crédito de ${app.masks.formatCurrency(amountPaid - sale.total)} gerado.`;
            }
            app.ui.showToast(toastMessage);
            
            if (sale.clientId !== 0) {
                app.renderClientDetail(sale.clientId);
            } else {
                app.renderVendas();
            }
        };
        
        app.ui.showConfirmation(`Deseja imprimir o recibo da venda #${sale.orderNumber}?`,
            () => { 
                const printWindow = app.handlePrintSale(sale.id);
                if (printWindow) {
                    const checkPrintWindow = setInterval(() => {
                        if (printWindow.closed) {
                            clearInterval(checkPrintWindow);
                            window.focus();
                            finalAction();
                        }
                    }, 500);
                } else {
                    finalAction();
                }
            },
            () => { finalAction(); }
        );
    },

    handleCancelSale: (saleId) => { app.ui.showConfirmation('Deseja cancelar esta venda? O estoque dos produtos será revertido.', () => { const sales = db.load('sales'); const sale = sales.find(s => s.id === saleId); if (sale && sale.status !== 'Cancelada') { sale.status = 'Cancelada'; db.save('sales', sales); const products = db.load('products'); sale.items.forEach(item => { const product = products.find(p => p.id === item.productId); if (product) { product.stock += item.quantity; } }); db.save('products', products); app.ui.showToast(`Venda #${sale.orderNumber} cancelada!`); app.renderClientDetail(sale.clientId); } }); },
    handleSavePayment: (event, clientId) => { event.preventDefault(); const amount = app.masks.unformatCurrency(document.getElementById('payment-amount').value); const method = document.getElementById('payment-method').value; if (!amount || amount <= 0) { app.ui.showToast('Insira um valor de pagamento válido.', 'error'); return; } const payments = db.load('payments'); payments.push({ id: Date.now(), clientId: clientId, amount: amount, method: method, date: new Date().toISOString() }); db.save('payments', payments); app.ui.showToast('Pagamento registrado!'); app.renderClientDetail(clientId); },
    
    handleGenerateReport: () => {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const clientFilter = document.getElementById('client-filter').value;
        const resultsContainer = document.getElementById('report-results');

        if (!startDate || !endDate) {
            app.ui.showToast("Por favor, selecione data de início e fim.", "error");
            return;
        }

        const start = new Date(startDate + 'T00:00:00');
        const end = new Date(endDate + 'T23:59:59');

        let sales = db.load('sales').filter(s => {
            const saleDate = new Date(s.date);
            return s.status !== 'Cancelada' && saleDate >= start && saleDate <= end;
        });

        if (clientFilter !== 'all') {
            sales = sales.filter(s => s.clientId === parseInt(clientFilter));
        }

        if (sales.length === 0) {
            resultsContainer.innerHTML = `<div class="card"><p>Nenhuma venda encontrada para os filtros selecionados.</p></div>`;
            return;
        }

        const totalSold = sales.reduce((sum, s) => sum + s.total, 0);
        const totalItems = sales.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.quantity, 0), 0);
        const totalCost = sales.reduce((sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + ((i.costPrice || 0) * i.quantity), 0), 0);
        const totalProfit = totalSold - totalCost;
        
        const topProducts = sales.flatMap(s => s.items).reduce((acc, item) => { acc[item.name] = (acc[item.name] || 0) + item.quantity; return acc; }, {});
        const sortedProducts = Object.entries(topProducts).sort(([,a],[,b]) => b-a).slice(0, 5).map(([name, qty]) => `<li>${name}: <strong>${qty}</strong> un.</li>`).join('');

        resultsContainer.innerHTML = `
            <div class="card">
                <h3>Relatório de Vendas de ${start.toLocaleDateString('pt-BR')} a ${end.toLocaleDateString('pt-BR')}</h3>
                <div class="quick-view-cards" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                    <div class="stat-card"><div class="stat-card-value">${sales.length}</div><div class="stat-card-label">Vendas Realizadas</div></div>
                    <div class="stat-card"><div class="stat-card-value">${totalItems}</div><div class="stat-card-label">Itens Vendidos</div></div>
                    <div class="stat-card"><div class="stat-card-value" style="color: var(--primary-color);">${app.masks.formatCurrency(totalSold)}</div><div class="stat-card-label">Total Faturado</div></div>
                    <div class="stat-card"><div class="stat-card-value" style="color: var(--success-color);">${app.masks.formatCurrency(totalProfit)}</div><div class="stat-card-label">Lucro Estimado</div></div>
                </div>
            </div>
            <div class="card">
                <h3>Top 5 Produtos Vendidos</h3>
                <ul style="list-style-position: inside;">${sortedProducts.length ? sortedProducts : 'Nenhum produto vendido no período.'}</ul>
            </div>
        `;
    },

    calculateClientBalance: (clientId) => { const totalSales = db.load('sales').filter(s => s.clientId === clientId && s.status !== 'Cancelada').reduce((sum, s) => sum + s.total, 0); const totalPayments = db.load('payments').filter(p => p.clientId === clientId).reduce((sum, p) => sum + p.amount, 0); return totalSales - totalPayments; },
    calculateDiscountValue: (subtotal, discount) => { if (!discount || discount.value <= 0) return 0; return discount.type === '%' ? (subtotal * discount.value) / 100 : discount.value; },
    setActiveNav: (buttonId) => { document.querySelectorAll('nav button').forEach(button => { button.classList.remove('active'); }); document.getElementById(buttonId).classList.add('active'); },
    toggleForm: (formId, buttonId, show) => { document.getElementById(formId).style.display = show ? 'block' : 'none'; const button = document.getElementById(buttonId); if(button) button.style.display = show ? 'none' : 'inline-block'; if (show) { document.querySelector(`#${formId} input`)?.focus(); } },
    
    handleExportData: () => { const backupData = { clients: db.load('clients'), products: db.load('products'), orders: db.load('orders'), sales: db.load('sales'), payments: db.load('payments'), sale_counter: db.load('sale_counter'), brands: db.load('brands'), company_data: db.load('company_data') }; const dataStr = JSON.stringify(backupData, null, 2); const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr); const exportFileDefaultName = `backup-sistema-vendas-${new Date().toISOString().slice(0,10)}.json`; const linkElement = document.createElement('a'); linkElement.setAttribute('href', dataUri); linkElement.setAttribute('download', exportFileDefaultName); linkElement.click(); },
    handleImportData: (event) => { const file = event.target.files[0]; if (!file) return; app.ui.showConfirmation('Deseja importar este backup? TODOS os dados atuais serão substituídos.', () => { const reader = new FileReader(); reader.onload = function(e) { try { const importedData = JSON.parse(e.target.result); if (importedData.clients && importedData.products) { for (const key in importedData) { db.save(key, importedData[key]); } localStorage.setItem('db_initialized', 'true'); app.ui.showToast('Backup importado com sucesso!'); app.renderVendas(); } else { app.ui.showToast('Erro: O arquivo de backup parece ser inválido.', 'error'); } } catch (error) { app.ui.showToast('Erro ao ler o arquivo de backup.', 'error'); console.error("Erro no parse do JSON:", error); } }; reader.readAsText(file); }); event.target.value = null; },
    selectAutocompleteItem: (name, id, resultsId, hiddenId, searchId) => { document.getElementById(searchId).value = name; document.getElementById(hiddenId).value = id; document.getElementById(resultsId).innerHTML = ''; },
    
    handlePrintSale: (saleId) => {
        const sale = db.load('sales').find(s => s.id === saleId);
        const client = db.load('clients').find(c => c.id === sale.clientId);
        const company = db.load('company_data');
        if (!sale || !client) {
            app.ui.showToast('Dados da venda não encontrados.', 'error');
            return null;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            app.ui.showToast('Não foi possível abrir a janela de impressão. Verifique seu bloqueador de pop-ups.', 'error');
            return null;
        }

        let receipt = `<div style="width: 58mm; font-family: 'Courier New', Courier, monospace; font-size: 10px; line-height: 1.4;">`;
        receipt += `<div style="text-align: center;">`;
        if (company.name) receipt += `<strong>${company.name}</strong><br>`;
        if (company.address) receipt += `${company.address}<br>`;
        if (company.city || company.zip) receipt += `${company.city || ''}${company.zip ? ` - CEP: ${company.zip}` : ''}<br>`;
        if (company.cnpj) receipt += `CNPJ: ${company.cnpj}<br>`;
        if (company.phone) receipt += `Tel: ${company.phone}<br>`;
        receipt += `----------------------------------------<br></div>`;
        receipt += `<strong>COMPROVANTE NAO FISCAL</strong><br>`;
        receipt += `PEDIDO/VENDA: <strong>#${sale.orderNumber}</strong><br>`;
        receipt += `CLIENTE: ${client.name}<br>`;
        receipt += `DATA: ${new Date(sale.date).toLocaleString('pt-BR')}<br>`;
        receipt += `----------------------------------------<br>`;
        receipt += `QTD  PRODUTO/CICLO             VALOR<br>`;
        sale.items.forEach(item => {
            const name = `${item.name} (${item.cycle})`.padEnd(28, ' ').substring(0, 28);
            const qty = item.quantity.toString().padStart(3, ' ');
            const price = app.masks.formatCurrency(item.total).padStart(12, ' ');
            receipt += `${qty} ${name}${price}<br>`;
        });
        receipt += `----------------------------------------<br>`;
        const subtotal = sale.subtotal || sale.total;
        receipt += `<div style="text-align: right;">SUBTOTAL:${app.masks.formatCurrency(subtotal).padStart(31)}</div>`;
        if (sale.discount && sale.discount.value > 0) {
            const discountValue = app.calculateDiscountValue(subtotal, sale.discount);
            receipt += `<div style="text-align: right;">DESCONTO:${("-" + app.masks.formatCurrency(discountValue)).padStart(30)}</div>`;
        }
        receipt += `<div style="text-align: right; font-size: 12px; font-weight: bold;">TOTAL:${app.masks.formatCurrency(sale.total).padStart(33)}</div>`;
        receipt += `----------------------------------------<br>`;
        if (company.receiptMessage) receipt += `<div style="text-align: center;">${company.receiptMessage}</div>`;
        receipt += `</div>`;

        printWindow.document.write(`<html><head><title>Imprimir Pedido #${sale.orderNumber}</title><style>@media print { @page { size: 58mm auto; margin: 0; } body { margin: 0; padding: 5px; } }</style></head><body>${receipt}</body></html>`);
        printWindow.document.close();
        
        setTimeout(() => {
            try {
                printWindow.focus();
                printWindow.print();
                printWindow.close();
            } catch (e) {
                console.error("Erro ao tentar imprimir:", e);
            }
        }, 250);

        return printWindow;
    },

    ui: {
        showToast: (message, type = 'success') => { const toastContainer = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast-notification ${type}`; toast.textContent = message; toastContainer.appendChild(toast); setTimeout(() => { toast.classList.add('show'); }, 100); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { toast.remove(); }, 300); }, 3000); },
        showModal: (content) => { const modalContainer = document.getElementById('modal-container'); modalContainer.innerHTML = `<div class="modal-overlay">${content}</div>`; setTimeout(() => { document.querySelector('.modal-content input, .modal-content button')?.focus() }, 100); },
        closeModal: () => { document.getElementById('modal-container').innerHTML = ''; },
        showConfirmation: (message, onConfirm, onDecline) => { const content = `<div class="modal-content"><h2>Confirmação</h2><p>${message}</p><div class="modal-actions"><button id="confirm-yes" class="btn btn-success">Sim</button><button id="confirm-no" class="btn btn-secondary">Não</button></div></div>`; app.ui.showModal(content); document.getElementById('confirm-yes').addEventListener('click', () => { if(onConfirm) onConfirm(); app.ui.closeModal(); }); document.getElementById('confirm-no').addEventListener('click', () => { if(onDecline) onDecline(); app.ui.closeModal(); }); }
    },
    masks: {
        phone: (event) => { let v = event.target.value.replace(/\D/g,''); v=v.replace(/^(\d{2})(\d)/g,"($1) $2"); v=v.replace(/(\d)(\d{4})$/,"$1-$2"); event.target.value = v.slice(0,15); },
        currency: (event) => { let value = event.target.value.replace(/\D/g, ''); if(value.length === 0) { event.target.value = ''; return; } value = (parseInt(value) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }); event.target.value = "R$ " + value; },
        formatCurrency: (value) => { if (typeof value !== 'number') return 'R$ 0,00'; return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); },
        unformatCurrency: (value) => { if(typeof value !== 'string') return value || 0; return parseFloat(String(value).replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0; }
    }
};

document.addEventListener('DOMContentLoaded', app.init);
