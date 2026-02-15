-- ============================================================================
-- V001: Core Asset Schema Migration
-- Asset Management System - Core Tables
-- 
-- This migration creates the foundational tables for the Asset Management System:
-- - departments: Organizational structure
-- - users: System users linked to Cognito
-- - roles: RBAC roles for access control
-- - permissions: Granular permission definitions
-- - user_roles: User-role assignments
-- - role_permissions: Role-permission assignments
-- - assets: Base asset table for all asset types
-- - audit_log: Change tracking for compliance
--
-- Requirements: 2.1, 2.4, 2.5, 2.7
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DEPARTMENTS TABLE
-- Organizational structure for user and asset assignment
-- ============================================================================
CREATE TABLE departments (
    department_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_department_id UUID REFERENCES departments(department_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE departments IS 'Organizational departments for user and asset assignment';
COMMENT ON COLUMN departments.code IS 'Unique department code (e.g., IT, HR, FIN)';
COMMENT ON COLUMN departments.parent_department_id IS 'Parent department for hierarchical structure';

-- Index for hierarchical queries
CREATE INDEX idx_departments_parent ON departments(parent_department_id);

-- ============================================================================
-- USERS TABLE
-- System users linked to Cognito for authentication
-- Requirement: 2.7 (created_by, updated_by references)
-- ============================================================================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cognito_sub VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    department_id UUID REFERENCES departments(department_id),
    manager_id UUID REFERENCES users(user_id),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE users IS 'System users linked to Cognito authentication';
COMMENT ON COLUMN users.cognito_sub IS 'Cognito user pool subject identifier';
COMMENT ON COLUMN users.manager_id IS 'Direct manager for approval workflows';

-- Indexes for common queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_cognito ON users(cognito_sub);
CREATE INDEX idx_users_department ON users(department_id);
CREATE INDEX idx_users_manager ON users(manager_id);

-- ============================================================================
-- ROLES TABLE
-- RBAC roles for access control
-- Requirement: 2.5 (audit history requires role-based access)
-- ============================================================================
CREATE TABLE roles (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE roles IS 'RBAC roles for access control';
COMMENT ON COLUMN roles.is_system_role IS 'System roles cannot be deleted or modified';

-- Insert default system roles
INSERT INTO roles (role_name, description, is_system_role) VALUES
    ('SYSTEM_ADMIN', 'Full system administration access', TRUE),
    ('ASSET_MANAGER', 'Manage all asset types and lifecycle', TRUE),
    ('INVENTORY_MANAGER', 'Manage stockrooms and inventory', TRUE),
    ('PROCUREMENT_MANAGER', 'Manage purchase orders and vendors', TRUE),
    ('LICENSE_ANALYST', 'Manage software licenses and compliance', TRUE),
    ('MAINTENANCE_TECHNICIAN', 'Execute work orders and maintenance tasks', TRUE),
    ('AUDITOR', 'Read-only access for compliance auditing', TRUE),
    ('VIEWER', 'Basic read-only access to assets', TRUE);

-- ============================================================================
-- PERMISSIONS TABLE
-- Granular permission definitions for RBAC
-- ============================================================================
CREATE TABLE permissions (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_name VARCHAR(100) UNIQUE NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    action VARCHAR(30) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE permissions IS 'Granular permission definitions for RBAC';
COMMENT ON COLUMN permissions.resource_type IS 'Resource type (e.g., ASSET, USER, STOCKROOM)';
COMMENT ON COLUMN permissions.action IS 'Action type (e.g., CREATE, READ, UPDATE, DELETE)';

-- Create unique constraint on resource_type + action combination
CREATE UNIQUE INDEX idx_permissions_resource_action ON permissions(resource_type, action);

-- Insert default permissions for assets
INSERT INTO permissions (permission_name, resource_type, action, description) VALUES
    -- Asset permissions
    ('asset:create', 'ASSET', 'CREATE', 'Create new assets'),
    ('asset:read', 'ASSET', 'READ', 'View asset details'),
    ('asset:update', 'ASSET', 'UPDATE', 'Modify asset attributes'),
    ('asset:delete', 'ASSET', 'DELETE', 'Delete assets'),
    ('asset:transition', 'ASSET', 'TRANSITION', 'Change asset lifecycle status'),
    
    -- User permissions
    ('user:create', 'USER', 'CREATE', 'Create new users'),
    ('user:read', 'USER', 'READ', 'View user details'),
    ('user:update', 'USER', 'UPDATE', 'Modify user attributes'),
    ('user:delete', 'USER', 'DELETE', 'Deactivate users'),
    
    -- Role permissions
    ('role:create', 'ROLE', 'CREATE', 'Create new roles'),
    ('role:read', 'ROLE', 'READ', 'View role details'),
    ('role:update', 'ROLE', 'UPDATE', 'Modify role permissions'),
    ('role:delete', 'ROLE', 'DELETE', 'Delete custom roles'),
    ('role:assign', 'ROLE', 'ASSIGN', 'Assign roles to users'),
    
    -- Audit permissions
    ('audit:read', 'AUDIT', 'READ', 'View audit logs'),
    ('audit:export', 'AUDIT', 'EXPORT', 'Export audit reports');

-- ============================================================================
-- USER_ROLES TABLE
-- Many-to-many relationship between users and roles
-- ============================================================================
CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(user_id),
    
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE user_roles IS 'User-role assignments for RBAC';
COMMENT ON COLUMN user_roles.assigned_by IS 'User who assigned this role';

-- Index for role-based queries
CREATE INDEX idx_user_roles_role ON user_roles(role_id);

-- ============================================================================
-- ROLE_PERMISSIONS TABLE
-- Many-to-many relationship between roles and permissions
-- ============================================================================
CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE role_permissions IS 'Role-permission assignments for RBAC';

-- Index for permission-based queries
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission_id);

-- Assign default permissions to system roles
-- SYSTEM_ADMIN gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'SYSTEM_ADMIN';

-- ASSET_MANAGER gets asset permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'ASSET_MANAGER'
  AND p.resource_type = 'ASSET';

-- AUDITOR gets read permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'AUDITOR'
  AND p.action IN ('READ', 'EXPORT');

-- VIEWER gets basic read permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM roles r, permissions p
WHERE r.role_name = 'VIEWER'
  AND p.action = 'READ'
  AND p.resource_type IN ('ASSET', 'USER');

-- ============================================================================
-- ASSETS TABLE
-- Core asset table serving as base for all asset types
-- Requirements: 2.1, 2.4 (lifecycle states)
-- ============================================================================
CREATE TABLE assets (
    asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tag VARCHAR(50) UNIQUE NOT NULL,
    asset_type VARCHAR(20) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ORDERED',
    substatus VARCHAR(30),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    updated_by UUID REFERENCES users(user_id),
    
    -- Requirement 2.2: Support asset types including Hardware, Software, and Enterprise
    CONSTRAINT valid_asset_type CHECK (asset_type IN ('HARDWARE', 'SOFTWARE', 'ENTERPRISE')),
    
    -- Requirement 2.4: Track asset lifecycle states
    CONSTRAINT valid_status CHECK (status IN (
        'ORDERED',        -- Asset has been ordered but not yet received
        'RECEIVED',       -- Asset received at dock/stockroom
        'IN_STOCK',       -- Asset in stockroom inventory, available for deployment
        'RESERVED',       -- Asset reserved for a specific request/user
        'DEPLOYED',       -- Asset assigned and in active use
        'IN_MAINTENANCE', -- Asset undergoing repair or maintenance
        'RETIRED',        -- Asset removed from active service
        'DISPOSED'        -- Asset physically disposed/destroyed
    ))
);

COMMENT ON TABLE assets IS 'Core asset table - base for all asset types (Hardware, Software, Enterprise)';
COMMENT ON COLUMN assets.asset_tag IS 'Unique identifier for physical/logical asset tracking (Requirement 2.6)';
COMMENT ON COLUMN assets.asset_type IS 'Asset classification: HARDWARE, SOFTWARE, or ENTERPRISE';
COMMENT ON COLUMN assets.status IS 'Current lifecycle state (Requirement 2.4)';
COMMENT ON COLUMN assets.substatus IS 'Optional sub-state for detailed tracking';
COMMENT ON COLUMN assets.created_by IS 'User who created the asset record';
COMMENT ON COLUMN assets.updated_by IS 'User who last modified the asset record';

-- Indexes for common query patterns
CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_tag ON assets(asset_tag);
CREATE INDEX idx_assets_created_at ON assets(created_at);
CREATE INDEX idx_assets_updated_at ON assets(updated_at);
CREATE INDEX idx_assets_created_by ON assets(created_by);

-- Composite index for type + status queries (common dashboard queries)
CREATE INDEX idx_assets_type_status ON assets(asset_type, status);


-- ============================================================================
-- AUDIT_LOG TABLE
-- Complete audit history for all asset and entity changes
-- Requirement: 2.5, 2.7 (record complete audit history with timestamp, user, previous values)
-- ============================================================================
CREATE TABLE audit_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint for valid action types
    CONSTRAINT valid_action_type CHECK (action_type IN (
        'CREATE',         -- New record created
        'UPDATE',         -- Record modified
        'DELETE',         -- Record deleted (soft or hard)
        'STATUS_CHANGE',  -- Lifecycle status transition
        'ASSIGN',         -- Asset assigned to user
        'UNASSIGN',       -- Asset unassigned from user
        'TRANSFER',       -- Asset transferred between locations
        'LOGIN',          -- User login event
        'LOGOUT',         -- User logout event
        'PERMISSION_CHANGE' -- Role/permission modification
    ))
);

COMMENT ON TABLE audit_log IS 'Complete audit trail for compliance and change tracking (Requirement 2.5, 2.7)';
COMMENT ON COLUMN audit_log.action_type IS 'Type of action performed';
COMMENT ON COLUMN audit_log.resource_type IS 'Type of resource affected (e.g., ASSET, USER, ROLE)';
COMMENT ON COLUMN audit_log.resource_id IS 'ID of the affected resource';
COMMENT ON COLUMN audit_log.old_values IS 'Previous values before change (for UPDATE/DELETE)';
COMMENT ON COLUMN audit_log.new_values IS 'New values after change (for CREATE/UPDATE)';
COMMENT ON COLUMN audit_log.ip_address IS 'Client IP address for security tracking';
COMMENT ON COLUMN audit_log.user_agent IS 'Client user agent string';

-- Indexes for audit log queries
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_action ON audit_log(action_type);

-- Composite index for resource-specific audit queries
CREATE INDEX idx_audit_resource_time ON audit_log(resource_type, resource_id, timestamp DESC);

-- ============================================================================
-- TRIGGER FUNCTION: Update timestamp on modification
-- Automatically updates updated_at column on row modification
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to assets table
CREATE TRIGGER trigger_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to users table
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to departments table
CREATE TRIGGER trigger_departments_updated_at
    BEFORE UPDATE ON departments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to roles table
CREATE TRIGGER trigger_roles_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- TRIGGER FUNCTION: Audit log for asset changes
-- Automatically creates audit log entries for asset modifications
-- Requirement: 2.7 (create audit log entry preserving change history)
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_asset_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.created_by, v_action_type, 'ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Determine if this is a status change or general update
        IF OLD.status != NEW.status THEN
            v_action_type := 'STATUS_CHANGE';
        ELSE
            v_action_type := 'UPDATE';
        END IF;
        
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.updated_by, v_action_type, 'ASSET', NEW.asset_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (OLD.updated_by, v_action_type, 'ASSET', OLD.asset_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to assets table
CREATE TRIGGER trigger_audit_assets
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION audit_asset_changes();

-- ============================================================================
-- FUNCTION: Generate unique asset tag
-- Generates a unique asset tag with format: AMS-{TYPE_PREFIX}-{SEQUENCE}
-- Requirement: 2.6 (generate unique asset tag)
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_asset_tag(p_asset_type VARCHAR(20))
RETURNS VARCHAR(50) AS $$
DECLARE
    v_prefix VARCHAR(10);
    v_sequence INTEGER;
    v_tag VARCHAR(50);
BEGIN
    -- Determine prefix based on asset type
    CASE p_asset_type
        WHEN 'HARDWARE' THEN v_prefix := 'HW';
        WHEN 'SOFTWARE' THEN v_prefix := 'SW';
        WHEN 'ENTERPRISE' THEN v_prefix := 'EA';
        ELSE v_prefix := 'AS';
    END CASE;
    
    -- Get next sequence number for this type
    SELECT COALESCE(MAX(
        CASE 
            WHEN asset_tag ~ ('^AMS-' || v_prefix || '-[0-9]+$')
            THEN CAST(SUBSTRING(asset_tag FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM assets
    WHERE asset_type = p_asset_type;
    
    -- Generate tag with zero-padded sequence
    v_tag := 'AMS-' || v_prefix || '-' || LPAD(v_sequence::TEXT, 8, '0');
    
    RETURN v_tag;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_asset_tag IS 'Generates unique asset tag with format AMS-{TYPE}-{SEQUENCE}';

-- ============================================================================
-- VIEW: User permissions view
-- Flattened view of user permissions for authorization checks
-- ============================================================================
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT 
    u.user_id,
    u.email,
    r.role_name,
    p.permission_name,
    p.resource_type,
    p.action
FROM users u
JOIN user_roles ur ON u.user_id = ur.user_id
JOIN roles r ON ur.role_id = r.role_id
JOIN role_permissions rp ON r.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.permission_id
WHERE u.is_active = TRUE;

COMMENT ON VIEW v_user_permissions IS 'Flattened view of user permissions for authorization checks';

-- ============================================================================
-- VIEW: Asset summary view
-- Summary view for dashboard queries
-- ============================================================================
CREATE OR REPLACE VIEW v_asset_summary AS
SELECT 
    asset_type,
    status,
    COUNT(*) as asset_count,
    MIN(created_at) as earliest_created,
    MAX(created_at) as latest_created
FROM assets
GROUP BY asset_type, status;

COMMENT ON VIEW v_asset_summary IS 'Summary view for dashboard asset counts by type and status';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
