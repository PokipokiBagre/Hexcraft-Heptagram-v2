import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { hexConfigs } from './hex/config.js';

// 1. Detección síncrona (instantánea) de la base de datos
const selectedHex = localStorage.getItem('hex_selected') || 'hex1';
export let currentConfig = hexConfigs[selectedHex] || hexConfigs['hex1'];

// 2. Inicialización inmediata del cliente de Supabase para que ningún módulo tenga que esperar
export let supabase = createClient(currentConfig.dbUrl, currentConfig.dbAnonKey);

// ──────────────────────────────────────────────────────────────
// hexAuth: objeto principal de autenticación
// ──────────────────────────────────────────────────────────────
export const hexAuth = {

    // Estado en memoria
    _session: null,
    _perfil: null,

    // ── Inicializar (llamar al inicio de cada página) ──
    async init() {
        // Como la BD ya se conectó arriba, aquí solo nos encargamos de la sesión
        const { data: { session } } = await supabase.auth.getSession();
        this._session = session;

        if (session) {
            // Intentar cargar perfil con reintentos
            for (let intento = 0; intento < 3; intento++) {
                try {
                    const { data, error } = await supabase
                        .from('perfiles_usuario')
                        .select('rol, personaje_nombre, email')
                        .eq('id', session.user.id)
                        .single();
                    if (data) { this._perfil = data; break; }
                    if (error) console.warn(`Intento ${intento+1} fallido:`, error.message);
                } catch(e) { console.warn('Error cargando perfil:', e); }
                if (intento < 2) await new Promise(r => setTimeout(r, 500));
            }
        }

        // Escuchar cambios de sesión en tiempo real
        supabase.auth.onAuthStateChange(async (_event, session) => {
            this._session = session;
            if (session) {
                const { data } = await supabase
                    .from('perfiles_usuario')
                    .select('rol, personaje_nombre, email')
                    .eq('id', session.user.id)
                    .single();
                if (data) this._perfil = data;
            } else {
                this._perfil = null;
            }
        });

        return this.esAdmin();
    },

    // ── Getters de estado ──
    estaLogueado() { return this._session !== null; },
    esAdmin()      { return this._perfil?.rol === 'admin'; },
    esJugador()    { return this._perfil?.rol === 'jugador'; },
    getEmail()     { return this._session?.user?.email || null; },
    getPersonaje() { return this._perfil?.personaje_nombre || null; },
    getRol()       { return this._perfil?.rol || 'espectador'; },

    // ── Login con email + contraseña ──
    async login(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, mensaje: error.message };
        this._session = data.session;

        // Forzar el JWT en el cliente antes de cualquier query
        await supabase.auth.setSession({
            access_token:  data.session.access_token,
            refresh_token: data.session.refresh_token
        });

        // Reintentos: el JWT puede tardar un tick en propagarse al RLS
        let perfil = null;
        for (let i = 0; i < 4; i++) {
            if (i > 0) await new Promise(r => setTimeout(r, 300 * i));
            const { data: p, error: e } = await supabase
                .from('perfiles_usuario')
                .select('rol, personaje_nombre')
                .eq('id', data.user.id)
                .single();
            if (p) { perfil = p; break; }
            console.warn('Login: intento ' + (i + 1) + ' perfil fallido:', e?.message);
        }
        this._perfil = perfil;

        return { ok: true, esAdmin: perfil?.rol === 'admin' };
    },

    // ── Logout ──
    async logout() {
        await supabase.auth.signOut();
        this._session = null;
        this._perfil = null;
    },

    // ── Cambiar contraseña (el usuario debe estar logueado) ──
    async cambiarPassword(nuevaPassword) {
        const { error } = await supabase.auth.updateUser({ password: nuevaPassword });
        return error ? { ok: false, mensaje: error.message } : { ok: true };
    },

    // ── Crear usuario (solo llamas esto desde el panel admin de Supabase,
    //    o desde aquí si eres admin) ──
    async crearUsuario(email, password, rol = 'jugador', personajeNombre = null) {
        if (!this.esAdmin()) return { ok: false, mensaje: 'Sin permisos.' };

        // Nota: createUser solo funciona desde el backend (service_role key).
        // Para agregar jugadores, el admin les envía invitación por email
        // desde Supabase Dashboard → Authentication → Users → Invite
        // O usa la función de invitación:
        const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
        if (error) return { ok: false, mensaje: error.message };

        // Actualizar rol y personaje después de crear
        await supabase
            .from('perfiles_usuario')
            .update({ rol, personaje_nombre: personajeNombre })
            .eq('email', email);

        return { ok: true };
    },

    // ── Widget de login listo para usar en el HTML ──
    // Uso: document.getElementById('mi-div').innerHTML = hexAuth.renderLoginWidget();
    renderLoginWidget(redirectUrl = null) {
        const dest = redirectUrl || window.location.href;
        return `
        <div id="hex-login-widget" style="
            background: rgba(10,0,20,0.95);
            border: 2px solid #d4af37;
            border-radius: 12px;
            padding: 30px;
            max-width: 380px;
            margin: 0 auto;
            font-family: 'Cinzel', serif;
            box-shadow: 0 0 40px rgba(212,175,55,0.2);
        ">
            <h3 style="color:#d4af37; text-align:center; margin:0 0 20px 0;">⚙️ ACCESO OP</h3>
            <input id="hex-login-email" type="email" placeholder="Correo electrónico"
                style="width:100%; background:#000; color:#fff; border:1px solid #444;
                       padding:12px; border-radius:6px; font-family:'Cinzel'; box-sizing:border-box;
                       margin-bottom:12px; font-size:0.9em;"
                onkeydown="if(event.key==='Enter') hexAuth._submitLogin()">
            <input id="hex-login-pass" type="password" placeholder="Contraseña"
                style="width:100%; background:#000; color:#fff; border:1px solid #444;
                       padding:12px; border-radius:6px; font-family:'Cinzel'; box-sizing:border-box;
                       margin-bottom:16px; font-size:0.9em;"
                onkeydown="if(event.key==='Enter') hexAuth._submitLogin()">
            <button onclick="hexAuth._submitLogin()" style="
                width:100%; background:linear-gradient(145deg,#2e004f,#1a0033);
                color:#d4af37; border:1px solid #d4af37; padding:14px;
                border-radius:6px; font-family:'Cinzel'; font-weight:bold;
                font-size:1em; cursor:pointer; transition:0.2s;"
                onmouseover="this.style.background='#d4af37'; this.style.color='#000';"
                onmouseout="this.style.background='linear-gradient(145deg,#2e004f,#1a0033)'; this.style.color='#d4af37';">
                ENTRAR
            </button>
            <div id="hex-login-error" style="color:#ff4444; font-size:0.8em;
                 text-align:center; margin-top:10px; font-family:sans-serif; min-height:20px;"></div>
        </div>`;
    },

    // ── Función interna del botón del widget ──
    async _submitLogin() {
        const email = document.getElementById('hex-login-email')?.value?.trim();
        const pass  = document.getElementById('hex-login-pass')?.value;
        const errDiv = document.getElementById('hex-login-error');

        if (!email || !pass) {
            if (errDiv) errDiv.innerText = 'Completa email y contraseña.';
            return;
        }

        const btn = document.querySelector('#hex-login-widget button');
        if (btn) { btn.innerText = 'Verificando...'; btn.disabled = true; }

        const resultado = await this.login(email, pass);

        if (resultado.ok) {
            if (errDiv) errDiv.style.color = '#00ff00';
            if (errDiv) errDiv.innerText = `✅ Bienvenido, ${resultado.esAdmin ? 'MÁSTER' : 'Jugador'}`;
            setTimeout(() => window.location.reload(), 800);
        } else {
            if (errDiv) errDiv.innerText = '❌ Credenciales incorrectas.';
            if (btn) { btn.innerText = 'ENTRAR'; btn.disabled = false; }
        }
    },

    // ── Badge de estado que puedes poner en la nav de cualquier página ──
    renderStatusBadge() {
        if (this.esAdmin()) {
            return `<span style="background:#4a004a; color:#d4af37; border:1px dashed #d4af37;
                        padding:8px 14px; border-radius:4px; font-weight:bold;
                        font-family:'Cinzel'; cursor:pointer; font-size:0.85em;"
                    onclick="hexAuth._mostrarPanelSesion()">
                    ⚙️ MÁSTER
                    </span>`;
        } else if (this.estaLogueado()) {
            return `<span style="background:#003300; color:#00ff00; border:1px solid #00ff00;
                        padding:8px 14px; border-radius:4px; font-weight:bold;
                        font-family:'Cinzel'; cursor:pointer; font-size:0.85em;"
                    onclick="hexAuth._mostrarPanelSesion()">
                    🟢 ${this.getPersonaje() || this.getEmail()}
                    </span>`;
        } else {
            return `<button onclick="hexAuth._mostrarModalLogin()"
                        style="background:#111; color:#d4af37; border:1px dashed #555;
                               padding:8px 14px; border-radius:4px; font-weight:bold;
                               font-family:'Cinzel'; cursor:pointer; font-size:0.85em;">
                    🔒 Acceso OP
                    </button>`;
        }
    },

    // ── Modal de login flotante ──
    _mostrarModalLogin() {
        let modal = document.getElementById('hex-auth-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'hex-auth-modal';
            modal.style.cssText = `
                position:fixed; top:0; left:0; width:100vw; height:100vh;
                background:rgba(0,0,0,0.7); backdrop-filter:blur(4px);
                display:flex; align-items:center; justify-content:center;
                z-index:99999;`;
            modal.onclick = (e) => { if(e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        }
        modal.innerHTML = this.renderLoginWidget();
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('hex-login-email')?.focus(), 100);
    },

    // ── Panel de sesión activa (logout) ──
    _mostrarPanelSesion() {
        const confirmar = confirm(
            `Sesión activa: ${this.getEmail()}\nRol: ${this.getRol()}\n\n¿Cerrar sesión?`
        );
        if (confirmar) {
            this.logout().then(() => window.location.reload());
        }
    }
};

// Hacer disponible globalmente por compatibilidad con onclick en HTML
window.hexAuth = hexAuth;
