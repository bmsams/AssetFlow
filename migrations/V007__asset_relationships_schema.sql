-- ============================================================================
-- V007: Asset Relationships Schema Migration
-- Asset Management System - CMDB Relationship Tables
-- 
-- This migration creates the tables for managing asset relationships:
-- - asset_relationships: CMDB relationships between assets
--
-- Requirements: 2.3, 2.9
-- ============================================================================

-- ============================================================================
-- ASSET_RELATIONSHIPS TABLE
-- CMDB relationships between assets (parent-child, dependency, etc.)
-- Requirement: 2.3 (maintain asset relationships in the CMDB)
-- Requirement: 2.9 (enforce referential integrity for relationships)
-- ============================================================================
CREATE TABLE asset_relationships (
    relationship_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    target_asset_id UUID NOT NULL REFERENCES assets(asset_id) ON DELETE CASCADE,
    relation_type VARCHAR(30) NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(user_id),
    
    -- Prevent self-referential relationships
    CONSTRAINT no_self_reference CHECK (source_asset_id != target_asset_id),
    
    -- Valid relationship types (CMDB standard types)
    CONSTRAINT valid_relation_type CHECK (relation_type IN (
        'PARENT_CHILD',   -- Hierarchical relationship (e.g., server contains components)
        'DEPENDENCY',     -- Asset depends on another asset
        'CONNECTED_TO',   -- Network or physical connection
        'INSTALLED_ON',   -- Software installed on hardware
        'RUNS_ON',        -- Service runs on infrastructure
        'LOCATION',       -- Asset is located at/in another asset
        'COMPONENT'       -- Asset is a component of another asset
    )),
    
    -- Unique constraint to prevent duplicate relationships
    CONSTRAINT unique_relationship UNIQUE (source_asset_id, target_asset_id, relation_type)
);

COMMENT ON TABLE asset_relationships IS 'CMDB relationships between assets (Requirement 2.3)';
COMMENT ON COLUMN asset_relationships.source_asset_id IS 'Source asset in the relationship (e.g., parent, dependent)';
COMMENT ON COLUMN asset_relationships.target_asset_id IS 'Target asset in the relationship (e.g., child, dependency)';
COMMENT ON COLUMN asset_relationships.relation_type IS 'Type of relationship (PARENT_CHILD, DEPENDENCY, etc.)';
COMMENT ON COLUMN asset_relationships.metadata IS 'Additional relationship metadata as JSON';
COMMENT ON COLUMN asset_relationships.created_by IS 'User who created the relationship';

-- Indexes for common query patterns
CREATE INDEX idx_relationships_source ON asset_relationships(source_asset_id);
CREATE INDEX idx_relationships_target ON asset_relationships(target_asset_id);
CREATE INDEX idx_relationships_type ON asset_relationships(relation_type);
CREATE INDEX idx_relationships_created_at ON asset_relationships(created_at);

-- Composite index for finding all relationships for an asset (either direction)
CREATE INDEX idx_relationships_both_assets ON asset_relationships(source_asset_id, target_asset_id);

-- Index for finding relationships by type for a specific asset
CREATE INDEX idx_relationships_source_type ON asset_relationships(source_asset_id, relation_type);
CREATE INDEX idx_relationships_target_type ON asset_relationships(target_asset_id, relation_type);

-- ============================================================================
-- TRIGGER FUNCTION: Audit log for relationship changes
-- Automatically creates audit log entries for relationship modifications
-- ============================================================================
CREATE OR REPLACE FUNCTION audit_relationship_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action_type VARCHAR(50);
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action_type := 'CREATE';
        v_old_values := NULL;
        v_new_values := jsonb_build_object(
            'relationship_id', NEW.relationship_id,
            'source_asset_id', NEW.source_asset_id,
            'target_asset_id', NEW.target_asset_id,
            'relation_type', NEW.relation_type,
            'metadata', NEW.metadata
        );
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (NEW.created_by, v_action_type, 'ASSET_RELATIONSHIP', NEW.relationship_id, v_old_values, v_new_values);
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action_type := 'DELETE';
        v_old_values := jsonb_build_object(
            'relationship_id', OLD.relationship_id,
            'source_asset_id', OLD.source_asset_id,
            'target_asset_id', OLD.target_asset_id,
            'relation_type', OLD.relation_type,
            'metadata', OLD.metadata
        );
        v_new_values := NULL;
        
        INSERT INTO audit_log (user_id, action_type, resource_type, resource_id, old_values, new_values)
        VALUES (OLD.created_by, v_action_type, 'ASSET_RELATIONSHIP', OLD.relationship_id, v_old_values, v_new_values);
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit trigger to asset_relationships table
CREATE TRIGGER trigger_audit_relationships
    AFTER INSERT OR DELETE ON asset_relationships
    FOR EACH ROW
    EXECUTE FUNCTION audit_relationship_changes();

-- ============================================================================
-- VIEW: Asset relationships with asset details
-- Provides a convenient view of relationships with source and target asset info
-- ============================================================================
CREATE OR REPLACE VIEW v_asset_relationships AS
SELECT 
    r.relationship_id,
    r.source_asset_id,
    sa.asset_tag AS source_asset_tag,
    sa.display_name AS source_display_name,
    sa.asset_type AS source_asset_type,
    r.target_asset_id,
    ta.asset_tag AS target_asset_tag,
    ta.display_name AS target_display_name,
    ta.asset_type AS target_asset_type,
    r.relation_type,
    r.metadata,
    r.created_at,
    r.created_by
FROM asset_relationships r
JOIN assets sa ON r.source_asset_id = sa.asset_id
JOIN assets ta ON r.target_asset_id = ta.asset_id;

COMMENT ON VIEW v_asset_relationships IS 'Asset relationships with source and target asset details';

-- ============================================================================
-- VIEW: Asset relationship counts by type
-- Summary view for relationship statistics
-- ============================================================================
CREATE OR REPLACE VIEW v_relationship_summary AS
SELECT 
    relation_type,
    COUNT(*) as relationship_count
FROM asset_relationships
GROUP BY relation_type;

COMMENT ON VIEW v_relationship_summary IS 'Summary of relationship counts by type';

-- ============================================================================
-- FUNCTION: Get all ancestors of an asset (for hierarchical relationships)
-- Useful for checking circular dependencies and building hierarchy trees
-- ============================================================================
CREATE OR REPLACE FUNCTION get_asset_ancestors(
    p_asset_id UUID,
    p_relation_type VARCHAR(30) DEFAULT 'PARENT_CHILD'
)
RETURNS TABLE (
    ancestor_id UUID,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: direct parents
        SELECT 
            r.source_asset_id AS ancestor_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.target_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: parents of parents
        SELECT 
            r.source_asset_id,
            a.depth + 1
        FROM asset_relationships r
        INNER JOIN ancestors a ON r.target_asset_id = a.ancestor_id
        WHERE r.relation_type = p_relation_type
          AND a.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT a.ancestor_id, MIN(a.depth) AS depth
    FROM ancestors a
    GROUP BY a.ancestor_id
    ORDER BY depth;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_asset_ancestors IS 'Returns all ancestors of an asset for hierarchical relationships';

-- ============================================================================
-- FUNCTION: Get all descendants of an asset (for hierarchical relationships)
-- Useful for propagating status changes and building hierarchy trees
-- ============================================================================
CREATE OR REPLACE FUNCTION get_asset_descendants(
    p_asset_id UUID,
    p_relation_type VARCHAR(30) DEFAULT 'PARENT_CHILD'
)
RETURNS TABLE (
    descendant_id UUID,
    depth INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT 
            r.target_asset_id AS descendant_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.source_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT 
            r.target_asset_id,
            d.depth + 1
        FROM asset_relationships r
        INNER JOIN descendants d ON r.source_asset_id = d.descendant_id
        WHERE r.relation_type = p_relation_type
          AND d.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT d.descendant_id, MIN(d.depth) AS depth
    FROM descendants d
    GROUP BY d.descendant_id
    ORDER BY depth;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_asset_descendants IS 'Returns all descendants of an asset for hierarchical relationships';

-- ============================================================================
-- FUNCTION: Check if creating a relationship would cause a circular dependency
-- Returns TRUE if a cycle would be created
-- ============================================================================
CREATE OR REPLACE FUNCTION would_create_cycle(
    p_source_asset_id UUID,
    p_target_asset_id UUID,
    p_relation_type VARCHAR(30)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_cycle BOOLEAN;
BEGIN
    -- Only check for hierarchical relationship types
    IF p_relation_type NOT IN ('PARENT_CHILD', 'DEPENDENCY') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if target is already an ancestor of source
    SELECT EXISTS(
        SELECT 1 
        FROM get_asset_ancestors(p_source_asset_id, p_relation_type) a
        WHERE a.ancestor_id = p_target_asset_id
    ) INTO v_has_cycle;
    
    RETURN v_has_cycle;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION would_create_cycle IS 'Checks if creating a relationship would cause a circular dependency';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
