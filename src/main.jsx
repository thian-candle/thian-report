import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Users,
  LogOut,
  Plus,
  RefreshCw,
} from "lucide-react";
import "./style.css";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "./theme/theme";
import LoginForm from "./components/auth/LoginForm";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;
const labels = {
  pending: "Pendiente",
  in_progress: "En proceso",
  finished: "Finalizado",
};
const fmtDate = (d) =>
  d ? new Date(d + "T12:00:00").toLocaleDateString("es-CO") : "Sin fecha";
function App() {
  const [session, setSession] = useState(null),
    [profile, setProfile] = useState(null),
    [roles, setRoles] = useState([]),
    [roleCatalog, setRoleCatalog] = useState([]),
    [assignments, setAssignments] = useState([]),
    [tab, setTab] = useState("dashboard"),
    [products, setProducts] = useState([]),
    [orders, setOrders] = useState([]),
    [sellers, setSellers] = useState([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const hasRole = (...codes) => codes.some((c) => roles.includes(c));
  const admin = hasRole("admin");
  const canSell = hasRole("admin", "seller");
  const canProduce = hasRole("admin", "production");
  const canViewAll = hasRole("admin", "production", "billing", "supervisor");
  const message = (err, ok) => {
    setError(err?.message || "");
    setNotice(err ? "" : ok || "Guardado correctamente");
  };
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setProfile(null);
      setRoles([]);
      setOrders([]);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (active) {
          setProfile(error ? null : data);
          if (error) setError(error.message);
          else
            supabase.rpc("my_roles").then(({ data: rs, error: re }) => {
              if (active) {
                setRoles((rs || []).map((x) => x.code));
                if (re) setError(re.message);
              }
            });
        }
      });
    return () => {
      active = false;
    };
  }, [session]);
  async function reload() {
    if (!profile?.active) return;
    setBusy(true);
    const [p, o, s, r, ur] = await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase
        .from("orders")
        .select(
          "*,profiles(full_name),order_items(id,product_id,quantity,status,notes,products(name))",
        )
        .order("created_at", { ascending: false }),
      admin
        ? supabase.from("profiles").select("*").order("full_name")
        : Promise.resolve({ data: [], error: null }),
      admin
        ? supabase.from("roles").select("*").order("id")
        : Promise.resolve({ data: [], error: null }),
      admin
        ? supabase.from("user_roles").select("user_id,role_id")
        : Promise.resolve({ data: [], error: null }),
    ]);
    const err = p.error || o.error || s.error || r.error || ur.error;
    if (err) message(err);
    else {
      setProducts(p.data || []);
      setOrders(o.data || []);
      setSellers(s.data || []);
      setRoleCatalog(r.data || []);
      setAssignments(ur.data || []);
    }
    setBusy(false);
  }
  useEffect(() => {
    if (profile?.active && roles.length) reload();
  }, [profile?.id, profile?.active, roles.join("|")]);
  async function signin(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get("username") || "").trim();
    if (!/^[a-zA-Z0-9._]{4,20}$/.test(username)) {
      setError("Ingresa un nombre de usuario válido.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("login-username", {
      body: { username, password: String(fd.get("password") || "") },
    });
    if (error || !data?.access_token || !data?.refresh_token) {
      setError("Usuario o contraseña incorrectos.");
      setBusy(false);
      return;
    }
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionError)
      setError("No se pudo iniciar sesión. Intenta nuevamente.");
    setBusy(false);
  }
  async function saveUsername(userId, username) {
    const value = username.trim();
    if (!/^[a-zA-Z0-9._]{4,20}$/.test(value)) {
      setError(
        "El username debe tener entre 4 y 20 caracteres: letras, números, punto o guion bajo.",
      );
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: value })
      .eq("id", userId);
    message(error, "Username actualizado");
    if (!error) await reload();
    setBusy(false);
  }
  async function setUserRole(userId, roleId, enabled) {
    setBusy(true);
    setError("");
    const query = enabled
      ? supabase.from("user_roles").insert({ user_id: userId, role_id: roleId })
      : supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role_id", roleId);
    const { error } = await query;
    message(error, "Roles actualizados");
    if (!error) await reload();
    setBusy(false);
  }
  async function createUser(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = e.currentTarget,
      fd = new FormData(form);
    const payload = {
      full_name: String(fd.get("full_name") || "").trim(),
      username: String(fd.get("username") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || ""),
      roles: fd.getAll("roles"),
    };
    if (!/^[a-zA-Z0-9._]{4,20}$/.test(payload.username)) {
      setError(
        "Username inválido: entre 4 y 20 caracteres, letras, números, punto o guion bajo.",
      );
      setBusy(false);
      return;
    }
    if (!payload.roles.length) {
      setError("Selecciona al menos un rol.");
      setBusy(false);
      return;
    }
    const { data, error } = await supabase.functions.invoke("create-user", {
      body: payload,
    });
    if (error || data?.error) {
      let detail = data?.error || "No fue posible crear la cuenta.";
      if (error?.context) {
        try {
          const body = await error.context.json();
          detail = body.error || detail;
        } catch {}
      }
      setError(detail);
    } else {
      setNotice("Usuario creado correctamente.");
      form.reset();
      await reload();
    }
    setBusy(false);
  }
  async function createProduct(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase
      .from("products")
      .insert({
        name: f.get("name").trim(),
        sku: f.get("sku")?.trim() || null,
        description: f.get("description") || null,
        image_url: f.get("image_url") || null,
      });
    message(error, "Producto registrado");
    if (!error) {
      e.currentTarget.reset();
      await reload();
    }
    setBusy(false);
  }
  async function createOrder(e, lines) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.rpc("create_order", {
      p_customer_name: f.get("customer_name"),
      p_customer_phone: f.get("customer_phone"),
      p_delivery_date: f.get("delivery_date") || null,
      p_notes: f.get("notes"),
      p_items: lines.map((x) => ({
        product_id: x.product_id,
        quantity: Number(x.quantity),
        notes: x.notes || "",
      })),
    });
    message(error, "Pedido registrado correctamente");
    if (!error) {
      setTab("orders");
      await reload();
    }
    setBusy(false);
  }
  async function changeStatus(id, status) {
    setBusy(true);
    const { error } = await supabase
      .from("order_items")
      .update({ status })
      .eq("id", id);
    message(error, "Estado actualizado");
    if (!error) await reload();
    setBusy(false);
  }
  async function changeSeller(id, patch) {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", id);
    message(error, "Vendedor actualizado");
    if (!error) await reload();
    setBusy(false);
  }
  async function changeProduct(id, active) {
    setBusy(true);
    const { error } = await supabase
      .from("products")
      .update({ active })
      .eq("id", id);
    message(error, "Producto actualizado");
    if (!error) await reload();
    setBusy(false);
  }
  if (!supabase)
    return (
      <div className="center">
        <div className="panel">
          <h1>Thian Candle</h1>
          <p>
            Configura <code>VITE_SUPABASE_URL</code> y{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> para conectar la aplicación.
          </p>
        </div>
      </div>
    );
  if (loading) return <div className="center">Cargando…</div>;
  if (!session)
    return <LoginForm onSubmit={signin} busy={busy} error={error} />;
  if (!profile)
    return (
      <div className="center">
        <div className="panel">
          <h2>Preparando perfil…</h2>
          <p>{error || "Actualiza la página si el perfil no aparece."}</p>
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    );
  if (!profile.active)
    return (
      <div className="center">
        <div className="panel">
          <h2>Cuenta desactivada</h2>
          <p>Contacta al administrador.</p>
          <button onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    );
  const counts = { pending: 0, in_progress: 0, finished: 0 };
  orders.forEach((o) => o.order_items?.forEach((i) => counts[i.status]++));
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          🕯️ Thian Candle<small>Control de pedidos</small>
        </div>
        <div className="identity">
          {profile.full_name}
          <small>{roles.join(" · ") || "Sin roles"}</small>
        </div>
        <nav>
          {[
            ["dashboard", LayoutDashboard, "Resumen"],
            ["orders", ShoppingBag, "Pedidos"],
            ...(canSell ? [["new", Plus, "Nuevo pedido"]] : []),
            ["products", Package, "Productos"],
            ...(admin ? [["sellers", Users, "Usuarios y roles"]] : []),
          ].map(([id, Icon, title]) => (
            <button
              key={id}
              className={tab === id ? "selected" : ""}
              onClick={() => {
                setTab(id);
                setError("");
                setNotice("");
              }}
            >
              <Icon size={18} />
              {title}
            </button>
          ))}
        </nav>
        <button className="logout" onClick={() => supabase.auth.signOut()}>
          <LogOut size={17} /> Salir
        </button>
      </aside>
      <main>
        <header>
          <div>
            <h1>
              {
                {
                  dashboard: "Resumen general",
                  orders: "Pedidos",
                  new: "Registrar pedido",
                  products: "Productos",
                  sellers: "Vendedores",
                }[tab]
              }
            </h1>
            <p>Chispa de luz, fe y aroma</p>
          </div>
          <button
            className="secondary compact"
            onClick={reload}
            disabled={busy}
          >
            <RefreshCw size={16} /> Actualizar
          </button>
        </header>
        {error && <div className="alert error">{error}</div>}
        {notice && <div className="alert success">{notice}</div>}
        {tab === "dashboard" && (
          <>
            <div className="stats">
              {[
                ["Pedidos", orders.length],
                ["Pendientes", counts.pending],
                ["En proceso", counts.in_progress],
                ["Finalizados", counts.finished],
              ].map(([n, v]) => (
                <div className="stat" key={n}>
                  <strong>{v}</strong>
                  <span>{n}</span>
                </div>
              ))}
            </div>
            <h2>Pedidos recientes</h2>
            <Orders
              orders={orders.slice(0, 5)}
              admin={canProduce}
              busy={busy}
              changeStatus={changeStatus}
            />
          </>
        )}
        {tab === "orders" && (
          <Orders
            orders={orders}
            admin={canProduce}
            busy={busy}
            changeStatus={changeStatus}
          />
        )}
        {tab === "new" && canSell && (
          <OrderForm
            products={products.filter((p) => p.active)}
            busy={busy}
            onSubmit={createOrder}
          />
        )}
        {tab === "products" && (
          <>
            <div className="panel">
              <h2>Catálogo de productos</h2>
              {admin && (
                <form className="formgrid" onSubmit={createProduct}>
                  <input
                    name="name"
                    placeholder="Nombre del producto"
                    required
                  />
                  <input name="sku" placeholder="Referencia / SKU (opcional)" />
                  <input
                    name="image_url"
                    type="url"
                    placeholder="URL de fotografía (opcional)"
                  />
                  <input name="description" placeholder="Descripción" />
                  <button disabled={busy}>Agregar producto</button>
                </form>
              )}
            </div>
            <div className="panel tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Referencia</th>
                    <th>Estado</th>
                    {admin && <th>Acción</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.sku || "—"}</td>
                      <td>{p.active ? "Activo" : "Inactivo"}</td>
                      {admin && (
                        <td>
                          <button
                            className="secondary compact"
                            disabled={busy}
                            onClick={() => changeProduct(p.id, !p.active)}
                          >
                            {p.active ? "Desactivar" : "Activar"}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {tab === "sellers" && admin && (
          <div className="panel tablewrap">
            <h2>Usuarios y permisos</h2>
            <p>
              Crea cuentas desde aquí y asigna uno o varios roles. El correo se
              utiliza solo para recuperación de acceso; el inicio de sesión es
              con username.
            </p>
            <form className="user-create" onSubmit={createUser}>
              <h3>Registrar nuevo usuario</h3>
              <div className="formgrid">
                <label>
                  Nombre completo
                  <input
                    name="full_name"
                    placeholder="Nombre y apellido"
                    maxLength="100"
                    required
                  />
                </label>
                <label>
                  Username
                  <input
                    name="username"
                    placeholder="Ej. maria.ventas"
                    minLength="4"
                    maxLength="20"
                    pattern="[a-zA-Z0-9._]{4,20}"
                    required
                  />
                </label>
                <label>
                  Correo para recuperación
                  <input
                    name="email"
                    type="email"
                    autoComplete="off"
                    required
                  />
                </label>
                <label>
                  Contraseña inicial
                  <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength="10"
                    required
                  />
                </label>
              </div>
              <div className="rolechecks" aria-label="Roles del nuevo usuario">
                {roleCatalog.map((r) => (
                  <label key={r.id}>
                    <input
                      type="checkbox"
                      name="roles"
                      value={r.code}
                      defaultChecked={r.code === "seller"}
                    />
                    {r.name}
                  </label>
                ))}
              </div>
              <button disabled={busy}>Crear usuario</button>
            </form>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Username</th>
                  <th>Roles (marcar para asignar)</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {sellers.map((s) => (
                  <tr key={s.id}>
                    <td>{s.full_name}</td>
                    <td>
                      <UsernameEditor
                        user={s}
                        busy={busy}
                        onSave={saveUsername}
                      />
                    </td>
                    <td>
                      <div className="rolechecks">
                        {roleCatalog.map((r) => (
                          <label key={r.id}>
                            <input
                              type="checkbox"
                              disabled={
                                busy ||
                                (s.id === profile.id && r.code === "admin")
                              }
                              checked={assignments.some(
                                (a) => a.user_id === s.id && a.role_id === r.id,
                              )}
                              onChange={(e) =>
                                setUserRole(s.id, r.id, e.target.checked)
                              }
                            />
                            {r.name}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>{s.active ? "Activo" : "Inactivo"}</td>
                    <td>
                      {s.id !== profile.id && (
                        <button
                          className="secondary compact"
                          disabled={busy}
                          onClick={() =>
                            changeSeller(s.id, { active: !s.active })
                          }
                        >
                          {s.active ? "Desactivar" : "Activar"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
function UsernameEditor({ user, busy, onSave }) {
  const [value, setValue] = useState(user.username || "");
  useEffect(() => setValue(user.username || ""), [user.username]);
  return (
    <div className="username-edit">
      <input
        aria-label={"Username de " + user.full_name}
        value={value}
        maxLength={20}
        onChange={(e) => setValue(e.target.value)}
      />
      <button
        className="secondary compact"
        disabled={busy || value === user.username}
        onClick={() => onSave(user.id, value)}
      >
        Guardar
      </button>
    </div>
  );
}
function OrderForm({ products, busy, onSubmit }) {
  const [lines, setLines] = useState([
    { product_id: "", quantity: 1, notes: "" },
  ]);
  const edit = (idx, k, v) =>
    setLines((ls) => ls.map((x, i) => (i === idx ? { ...x, [k]: v } : x)));
  const valid =
    lines.length > 0 &&
    lines.every((l) => l.product_id && Number(l.quantity) > 0);
  return (
    <form className="panel" onSubmit={(e) => onSubmit(e, lines)}>
      <h2>Datos del pedido</h2>
      <div className="formgrid">
        <label>
          Cliente
          <input
            name="customer_name"
            required
            placeholder="Nombre del cliente"
          />
        </label>
        <label>
          Teléfono
          <input name="customer_phone" placeholder="Opcional" />
        </label>
        <label>
          Fecha de entrega
          <input name="delivery_date" type="date" />
        </label>
        <label>
          Observaciones generales
          <input name="notes" placeholder="Indicaciones del pedido" />
        </label>
      </div>
      <h2>Productos solicitados</h2>
      {lines.map((l, i) => (
        <div className="line" key={i}>
          <select
            value={l.product_id}
            required
            onChange={(e) => edit(i, "product_id", e.target.value)}
          >
            <option value="">Selecciona producto</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            min="1"
            value={l.quantity}
            onChange={(e) => edit(i, "quantity", e.target.value)}
            aria-label="Cantidad"
            required
          />
          <input
            placeholder="Detalle o personalización"
            value={l.notes}
            onChange={(e) => edit(i, "notes", e.target.value)}
          />
          <button
            type="button"
            className="secondary compact"
            disabled={lines.length === 1}
            onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
          >
            Quitar
          </button>
        </div>
      ))}
      <div className="actions">
        <button
          type="button"
          className="secondary"
          onClick={() =>
            setLines((ls) => [
              ...ls,
              { product_id: "", quantity: 1, notes: "" },
            ])
          }
        >
          + Otro producto
        </button>
        <button disabled={busy || !valid}>Guardar pedido</button>
      </div>
      {!products.length && (
        <p>
          El administrador debe crear productos activos antes de registrar
          pedidos.
        </p>
      )}
    </form>
  );
}
function Orders({ orders, admin, busy, changeStatus }) {
  const [filter, setFilter] = useState("all");
  const filtered = orders.filter(
    (o) => filter === "all" || o.order_items?.some((i) => i.status === filter),
  );
  return (
    <>
      <div className="filter">
        <label>
          Filtrar por estado{" "}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(labels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!filtered.length && (
        <div className="panel">No hay pedidos para mostrar.</div>
      )}
      {filtered.map((o) => (
        <article className="panel order" key={o.id}>
          <div className="orderhead">
            <div>
              <h2>Pedido #{o.order_number}</h2>
              <p>
                <b>Cliente:</b> {o.customer_name}{" "}
                {o.customer_phone && `· ${o.customer_phone}`}
              </p>
              <p>
                <b>Vendedor:</b> {o.profiles?.full_name || "—"} ·{" "}
                <b>Entrega:</b> {fmtDate(o.delivery_date)}
              </p>
            </div>
            <small>{new Date(o.created_at).toLocaleString("es-CO")}</small>
          </div>
          {o.notes && (
            <p>
              <b>Observaciones:</b> {o.notes}
            </p>
          )}
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {o.order_items?.map((i) => (
                  <tr key={i.id}>
                    <td>
                      {i.products?.name || "Producto"}
                      {i.notes && <small className="subnote">{i.notes}</small>}
                    </td>
                    <td>{i.quantity}</td>
                    <td>
                      {admin ? (
                        <select
                          aria-label="Estado de producción"
                          disabled={busy}
                          value={i.status}
                          onChange={(e) => changeStatus(i.id, e.target.value)}
                        >
                          {Object.entries(labels).map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className={"pill " + i.status}>
                          {labels[i.status]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ))}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <App />
  </ThemeProvider>,
);
