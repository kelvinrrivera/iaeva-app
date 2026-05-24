# Supabase Row Level Security (RLS) Policies

**Versión:** 1.0
**Fecha:** 2026-02-15
**Estado:** Pendiente de Implementación

---

## 📋 Overview

Row Level Security (RLS) es la **última línea de defensa** para proteger los datos en la base de datos. Las políticas RLS se ejecutan en la base de datos y **NO pueden ser saltadas** por el código de la aplicación.

---

## 🔐 Principios de RLS

### 1. Default Deny
Por defecto, **nadie** tiene acceso a los datos. Debes explícitamente dar permisos.

### 2. Tenant Isolation
Cada usuario **SOLO** puede ver datos de su propio shop.

### 3. Role-Based Access
Los permisos se basan en el rol del usuario dentro del shop.

---

## 📊 Políticas RLS Requeridas

### Users Table

```sql
-- Policy: Users can only see their own data
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver datos de Usuario B
- ✅ Usuario A no puede modificarse a sí mismo como admin

---

### Memberships Table

```sql
-- Policy: Users can only see their own memberships
CREATE POLICY "Users can view own memberships"
ON memberships FOR SELECT
USING (auth.uid() = userId);

-- Policy: Users can see other members of their shop
CREATE POLICY "Users can view shop memberships"
ON memberships FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver memberships de otros shops
- ✅ Usuario puede ver quién más está en su shop

---

### Shops Table

```sql
-- Policy: Users can only view their own shop
CREATE POLICY "Users can view own shop"
ON shops FOR SELECT
USING (
  id IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- Policy: Only ORG_ADMIN can update shop
CREATE POLICY "Org admins can update shop"
ON shops FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE userId = auth.uid()
      AND shopId = shops.id
      AND role = 'ORG_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE userId = auth.uid()
      AND shopId = shops.id
      AND role = 'ORG_ADMIN'
  )
);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver Shop B
- ✅ Solo admin puede modificar settings del shop
- ✅ Usuario común no puede hacerse admin

---

### Clients Table

```sql
-- Policy: Users can only view clients of their shop
CREATE POLICY "Users can view shop clients"
ON clients FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can insert clients
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can update clients
CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can delete clients
CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver clientes de Shop B
- ✅ Solo admins pueden crear/editar/eliminar clientes
- ✅ Cliente siempre queda asociado al shop correcto

---

### Appointments Table

```sql
-- Policy: Users can view appointments of their shop
CREATE POLICY "Users can view shop appointments"
ON appointments FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- Policy: PROFESSIONAL+ can insert appointments
CREATE POLICY "Staff can insert appointments"
ON appointments FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL')
  )
);

-- Policy: PROFESSIONAL+ can update appointments
CREATE POLICY "Staff can update appointments"
ON appointments FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL')
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can delete appointments
CREATE POLICY "Admins can delete appointments"
ON appointments FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver citas de Shop B
- ✅ Usuario solo puede crear citas para su shop
- ✅ Profesionales no pueden eliminar citas (solo admins)

---

### Services Table

```sql
-- Policy: Users can view services of their shop
CREATE POLICY "Users can view shop services"
ON services FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can manage services
CREATE POLICY "Admins can insert services"
ON services FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

CREATE POLICY "Admins can update services"
ON services FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

CREATE POLICY "Admins can delete services"
ON services FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);
```

**Seguridad que provee:**
- ✅ Usuario A no puede ver servicios de Shop B
- ✅ Solo admins pueden gestionar servicios
- ✅ Profesional no puede cambiar precios

---

### Stylists Table

```sql
-- Policy: Users can view stylists of their shop
CREATE POLICY "Users can view shop stylists"
ON stylists FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- Policy: ORG_ADMIN and TEAM_LEADER can manage stylists
CREATE POLICY "Admins can insert stylists"
ON stylists FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- Similar policies for UPDATE and DELETE
```

---

## 🧪 Testing de RLS

### Test 1: Tenant Isolation

```sql
-- TEST: Usuario de Shop A NO puede ver clientes de Shop B
-- Setup
-- Shop A: user_a@example.com (userId = 111)
-- Shop B: user_b@example.com (userId = 222)
-- Client en Shop A: clientId = 001

-- Ejecutar como user_a@example.com
SELECT * FROM clients WHERE id = '001';
-- ✅ EXPECTED: 1 row

-- Ejecutar como user_b@example.com
SELECT * FROM clients WHERE id = '001';
-- ✅ EXPECTED: 0 rows (vacío)
```

### Test 2: Role-Based Access

```sql
-- TEST: PROFESSIONAL no puede eliminar clientes
-- Setup
-- User con role = PROFESSIONAL
-- Client en el mismo shop

-- Ejecutar como PROFESSIONAL
DELETE FROM clients WHERE id = '001';
-- ✅ EXPECTED: ERROR "permission denied"
```

### Test 3: Cross-Shop Access Prevention

```sql
-- TEST: Usuario no puede crear appointment para otro shop
-- Setup
-- User en Shop A (shopId = 'shop-a')
-- Service en Shop B (shopId = 'shop-b')

-- Ejecutar como user de Shop A
INSERT INTO appointments (shopId, serviceId, ...)
VALUES ('shop-b', 'service-001', ...);
-- ✅ EXPECTED: ERROR "permission denied"
```

---

## 📝 SQL Script Completo

```sql
-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE stylists ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_blocks ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USERS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id);

-- ==========================================
-- MEMBERSHIPS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own memberships" ON memberships;
CREATE POLICY "Users can view own memberships"
ON memberships FOR SELECT
USING (auth.uid() = userId);

DROP POLICY IF EXISTS "Users can view shop memberships" ON memberships;
CREATE POLICY "Users can view shop memberships"
ON memberships FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

-- ==========================================
-- SHOPS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own shop" ON shops;
CREATE POLICY "Users can view own shop"
ON shops FOR SELECT
USING (
  id IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

DROP POLICY IF EXISTS "Org admins can update shop" ON shops;
CREATE POLICY "Org admins can update shop"
ON shops FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE userId = auth.uid()
      AND shopId = shops.id
      AND role = 'ORG_ADMIN'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM memberships
    WHERE userId = auth.uid()
      AND shopId = shops.id
      AND role = 'ORG_ADMIN'
  )
);

-- ==========================================
-- CLIENTS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view shop clients" ON clients;
CREATE POLICY "Users can view shop clients"
ON clients FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can insert clients" ON clients;
CREATE POLICY "Admins can insert clients"
ON clients FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can update clients" ON clients;
CREATE POLICY "Admins can update clients"
ON clients FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can delete clients" ON clients;
CREATE POLICY "Admins can delete clients"
ON clients FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- ==========================================
-- APPOINTMENTS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view shop appointments" ON appointments;
CREATE POLICY "Users can view shop appointments"
ON appointments FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

DROP POLICY IF EXISTS "Staff can insert appointments" ON appointments;
CREATE POLICY "Staff can insert appointments"
ON appointments FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL')
  )
);

DROP POLICY IF EXISTS "Staff can update appointments" ON appointments;
CREATE POLICY "Staff can update appointments"
ON appointments FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL')
  )
);

DROP POLICY IF EXISTS "Admins can delete appointments" ON appointments;
CREATE POLICY "Admins can delete appointments"
ON appointments FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- ==========================================
-- SERVICES TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view shop services" ON services;
CREATE POLICY "Users can view shop services"
ON services FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can insert services" ON services;
CREATE POLICY "Admins can insert services"
ON services FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can update services" ON services;
CREATE POLICY "Admins can update services"
ON services FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can delete services" ON services;
CREATE POLICY "Admins can delete services"
ON services FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

-- ==========================================
-- STYLISTS TABLE POLICIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view shop stylists" ON stylists;
CREATE POLICY "Users can view shop stylists"
ON stylists FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
  )
);

DROP POLICY IF EXISTS "Admins can insert stylists" ON stylists;
CREATE POLICY "Admins can insert stylists"
ON stylists FOR INSERT
WITH CHECK (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can update stylists" ON stylists;
CREATE POLICY "Admins can update stylists"
ON stylists FOR UPDATE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);

DROP POLICY IF EXISTS "Admins can delete stylists" ON stylists;
CREATE POLICY "Admins can delete stylists"
ON stylists FOR DELETE
USING (
  shopId IN (
    SELECT shopId FROM memberships
    WHERE userId = auth.uid()
      AND role IN ('ORG_ADMIN', 'TEAM_LEADER')
  )
);
```

---

## ✅ Checklist de Implementación

### Configuración de Supabase
- [ ] Habilitar RLS en todas las tablas
- [ ] Ejecutar script de políticas SQL
- [ ] Verificar que las políticas están activas
- [ ] Documentar políticas personalizadas

### Testing
- [ ] Test 1: Tenant isolation (Usuario A no ve datos de Shop B)
- [ ] Test 2: Role-based access (PROFESSIONAL no puede eliminar)
- [ ] Test 3: Cross-shop prevention (No puede crear para otro shop)
- [ ] Test 4: Update permissions (Solo admin puede actualizar shop)
- [ ] Test 5: Delete permissions (Solo admin puede eliminar)

### Verificación
- [ ] Revisar log de Supabase para queries bloqueadas
- [ ] Verificar que `anon` key NO tiene acceso sin autenticación
- [ ] Verificar que `service_role` key tiene acceso completo

### Documentación
- [ ] Documentar todas las políticas
- [ ] Crear guía de troubleshooting
- [ ] Documentar cómo añadir nuevas políticas

---

## 🚨 troubleshooting

### Problema: "Permission denied" inesperado

**Causa:** El usuario no tiene membership en el shop.

**Solución:**
```sql
-- Verificar membership
SELECT * FROM memberships WHERE userId = auth.uid();
```

### Problema: Usuario puede ver datos de otros shops

**Causa:** RLS no está habilitado en la tabla.

**Solución:**
```sql
ALTER TABLE nombre_tabla ENABLE ROW LEVEL SECURITY;
```

### Problema: Política no se aplica

**Causa:** Política existe pero está mal configurada.

**Solución:**
```sql
-- Revisar políticas existentes
SELECT * FROM pg_policies WHERE tablename = 'nombre_tabla';
```

---

**Última actualización:** 2026-02-15
**Mantenido por:** Equipo Domicitas
