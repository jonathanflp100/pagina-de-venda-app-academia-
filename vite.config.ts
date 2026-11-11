import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Mock in-memory store for dev server API
const devStore = {
  cadastros: new Map<string, any>(),
  createdTimestamps: new Map<string, number>(),
  domainVerified: new Map<string, boolean>(),
};

function devApiPlugin(): Plugin {
  return {
    name: 'dev-api-endpoints',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const parsedUrl = new URL(req.url, 'http://localhost');
        const pathname = parsedUrl.pathname;
        const searchParams = parsedUrl.searchParams;

        res.setHeader('Content-Type', 'application/json');

        // GET /api/cadastro/subdominio?nome=XXX
        if (req.method === 'GET' && pathname === '/api/cadastro/subdominio') {
          const nome = (searchParams.get('nome') || '').toLowerCase().trim();
          // Subdomínios reservados ou inválidos
          const reservados = ['demo', 'admin', 'app', 'api', 'suporte', 'root', 'teste'];
          const disponivel = nome.length >= 3 && nome.length <= 30 && !reservados.includes(nome);
          res.end(JSON.stringify({ disponivel }));
          return;
        }

        // POST /api/cadastro
        if (req.method === 'POST' && pathname === '/api/cadastro') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              if (!data.academia || !data.subdominio || !data.email) {
                res.statusCode = 400;
                res.end(JSON.stringify({ erro: 'Dados incompletos para o cadastro.' }));
                return;
              }
              const id = 'CAD-' + Math.floor(100000 + Math.random() * 900000);
              devStore.cadastros.set(id, data);
              devStore.createdTimestamps.set(id, Date.now());

              res.end(JSON.stringify({
                checkoutUrl: `/bem-vindo?cadastro=${id}&teste=1`,
                cadastroId: id,
              }));
            } catch (e) {
              res.statusCode = 400;
              res.end(JSON.stringify({ erro: 'Formato JSON inválido.' }));
            }
          });
          return;
        }

        // GET /api/cadastro/status?id=ID
        if (req.method === 'GET' && pathname === '/api/cadastro/status') {
          const id = searchParams.get('id') || '';
          const cadastro = devStore.cadastros.get(id);
          const createdAt = devStore.createdTimestamps.get(id) || Date.now();
          const elapsed = (Date.now() - createdAt) / 1000;

          // Se passar de 6 segundos fica pronto, entre 3 e 6 criando, antes pago
          const subdominio = cadastro?.subdominio || 'sua-academia';
          if (elapsed > 6) {
            res.end(JSON.stringify({
              status: 'pronto',
              appUrl: `https://${subdominio}.gymapp.com`,
              dominioProprio: cadastro?.dominioProprio || null,
            }));
          } else if (elapsed > 3) {
            res.end(JSON.stringify({ status: 'criando' }));
          } else {
            res.end(JSON.stringify({ status: 'pago' }));
          }
          return;
        }

        // GET /api/dominio/verificar?id=ID
        if (req.method === 'GET' && pathname === '/api/dominio/verificar') {
          const id = searchParams.get('id') || '';
          // Simula verificação
          const isVerified = devStore.domainVerified.get(id);
          if (isVerified) {
            res.end(JSON.stringify({ conectado: true, mensagem: 'Domínio conectado e verificado com sucesso!' }));
          } else {
            // Marca como verificado na segunda chamada
            devStore.domainVerified.set(id, true);
            res.end(JSON.stringify({ conectado: true, mensagem: 'CNAME propagado e certificado SSL ativo!' }));
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
