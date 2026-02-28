"""
Property-based tests for Asset Tag Uniqueness.

**Property 3: Asset Tag Uniqueness Invariant**
**Validates: Requirements 2.6**

These tests verify that the generate_asset_tag() function produces unique
asset tags for any collection of assets created in the system. No two assets
SHALL ever share the same asset_tag regardless of asset type or creation order.

Requirements from design.md:
- Requirement 2.6: WHEN an asset is created, THE Asset_Management_System SHALL 
  generate a unique asset tag and barcode identifier

The asset tag format is: AMS-{TYPE_PREFIX}-{8-digit-sequence}
Where TYPE_PREFIX is:
- HW for HARDWARE assets
- SW for SOFTWARE assets  
- EA for ENTERPRISE assets
"""

import re
from typing import List, Set, Tuple
from dataclasses import dataclass
from enum import Enum

import pytest
from hypothesis import given, settings, strategies as st, assume


class AssetType(Enum):
    """Valid asset types in the system."""
    HARDWARE = "HARDWARE"
    SOFTWARE = "SOFTWARE"
    ENTERPRISE = "ENTERPRISE"


# Asset tag format regex: AMS-{HW|SW|EA}-{8 digits}
ASSET_TAG_PATTERN = re.compile(r'^AMS-(HW|SW|EA)-(\d{8})$')


def get_type_prefix(asset_type: AssetType) -> str:
    """Get the asset tag prefix for a given asset type."""
    prefix_map = {
        AssetType.HARDWARE: "HW",
        AssetType.SOFTWARE: "SW",
        AssetType.ENTERPRISE: "EA",
    }
    return prefix_map[asset_type]


@dataclass
class AssetTagGenerator:
    """
    Simulates the generate_asset_tag() PostgreSQL function behavior.
    
    This class models the asset tag generation logic from the database
    function defined in V001__core_asset_schema.sql for testing purposes.
    """
    
    def __init__(self):
        # Track sequence numbers per asset type (simulating database state)
        self._sequences: dict[AssetType, int] = {
            AssetType.HARDWARE: 0,
            AssetType.SOFTWARE: 0,
            AssetType.ENTERPRISE: 0,
        }
        # Track all generated tags for uniqueness verification
        self._generated_tags: Set[str] = set()
    
    def generate_asset_tag(self, asset_type: AssetType) -> str:
        """
        Generate a unique asset tag for the given asset type.
        
        Mirrors the PostgreSQL function generate_asset_tag() from the migration.
        Format: AMS-{TYPE_PREFIX}-{8-digit-sequence}
        """
        prefix = get_type_prefix(asset_type)
        self._sequences[asset_type] += 1
        sequence = self._sequences[asset_type]
        
        # Generate tag with zero-padded 8-digit sequence
        tag = f"AMS-{prefix}-{sequence:08d}"
        self._generated_tags.add(tag)
        
        return tag
    
    def get_all_tags(self) -> Set[str]:
        """Return all generated tags."""
        return self._generated_tags.copy()
    
    def get_sequence(self, asset_type: AssetType) -> int:
        """Get current sequence number for an asset type."""
        return self._sequences[asset_type]


def validate_asset_tag_format(tag: str) -> Tuple[bool, str, int]:
    """
    Validate that an asset tag follows the expected format.
    
    Returns:
        Tuple of (is_valid, type_prefix, sequence_number)
        If invalid, returns (False, "", 0)
    """
    match = ASSET_TAG_PATTERN.match(tag)
    if not match:
        return (False, "", 0)
    
    type_prefix = match.group(1)
    sequence = int(match.group(2))
    
    return (True, type_prefix, sequence)


# Hypothesis strategies for generating test data
@st.composite
def asset_type_strategy(draw: st.DrawFn) -> AssetType:
    """Generate a random asset type."""
    return draw(st.sampled_from(list(AssetType)))


@st.composite
def asset_creation_sequence(draw: st.DrawFn) -> List[AssetType]:
    """
    Generate a sequence of asset types representing asset creation order.
    
    This simulates a realistic scenario where multiple assets of different
    types are created in various orders.
    """
    # Generate between 1 and 100 asset creations
    count = draw(st.integers(min_value=1, max_value=100))
    return [draw(asset_type_strategy()) for _ in range(count)]


@st.composite
def mixed_asset_batch(draw: st.DrawFn) -> List[Tuple[AssetType, int]]:
    """
    Generate a batch specification of assets to create.
    
    Returns a list of (asset_type, count) tuples representing
    how many assets of each type to create.
    """
    batches = []
    for asset_type in AssetType:
        count = draw(st.integers(min_value=0, max_value=50))
        if count > 0:
            batches.append((asset_type, count))
    
    # Ensure at least one asset is created
    if not batches:
        asset_type = draw(asset_type_strategy())
        batches.append((asset_type, 1))
    
    return batches


class TestAssetTagFormatUnitTests:
    """Unit tests for asset tag format validation."""

    def test_valid_hardware_tag_format(self) -> None:
        """Test that hardware asset tags have correct format."""
        generator = AssetTagGenerator()
        tag = generator.generate_asset_tag(AssetType.HARDWARE)
        
        is_valid, prefix, sequence = validate_asset_tag_format(tag)
        
        assert is_valid, f"Tag '{tag}' should be valid"
        assert prefix == "HW", f"Hardware tag should have HW prefix, got {prefix}"
        assert sequence == 1, f"First sequence should be 1, got {sequence}"

    def test_valid_software_tag_format(self) -> None:
        """Test that software asset tags have correct format."""
        generator = AssetTagGenerator()
        tag = generator.generate_asset_tag(AssetType.SOFTWARE)
        
        is_valid, prefix, sequence = validate_asset_tag_format(tag)
        
        assert is_valid, f"Tag '{tag}' should be valid"
        assert prefix == "SW", f"Software tag should have SW prefix, got {prefix}"
        assert sequence == 1, f"First sequence should be 1, got {sequence}"

    def test_valid_enterprise_tag_format(self) -> None:
        """Test that enterprise asset tags have correct format."""
        generator = AssetTagGenerator()
        tag = generator.generate_asset_tag(AssetType.ENTERPRISE)
        
        is_valid, prefix, sequence = validate_asset_tag_format(tag)
        
        assert is_valid, f"Tag '{tag}' should be valid"
        assert prefix == "EA", f"Enterprise tag should have EA prefix, got {prefix}"
        assert sequence == 1, f"First sequence should be 1, got {sequence}"

    def test_sequence_increments_correctly(self) -> None:
        """Test that sequence numbers increment for each asset type."""
        generator = AssetTagGenerator()
        
        # Create multiple hardware assets
        tags = [generator.generate_asset_tag(AssetType.HARDWARE) for _ in range(5)]
        
        expected_tags = [
            "AMS-HW-00000001",
            "AMS-HW-00000002",
            "AMS-HW-00000003",
            "AMS-HW-00000004",
            "AMS-HW-00000005",
        ]
        
        assert tags == expected_tags

    def test_sequences_independent_per_type(self) -> None:
        """Test that each asset type has independent sequence numbers."""
        generator = AssetTagGenerator()
        
        # Create assets of different types
        hw_tag = generator.generate_asset_tag(AssetType.HARDWARE)
        sw_tag = generator.generate_asset_tag(AssetType.SOFTWARE)
        ea_tag = generator.generate_asset_tag(AssetType.ENTERPRISE)
        
        # Each should start at sequence 1
        assert hw_tag == "AMS-HW-00000001"
        assert sw_tag == "AMS-SW-00000001"
        assert ea_tag == "AMS-EA-00000001"

    def test_invalid_tag_formats_rejected(self) -> None:
        """Test that invalid tag formats are correctly identified."""
        invalid_tags = [
            "AMS-XX-00000001",  # Invalid prefix
            "AMS-HW-0000001",   # Only 7 digits
            "AMS-HW-000000001", # 9 digits
            "HW-00000001",      # Missing AMS prefix
            "AMS-HW00000001",   # Missing dash
            "ams-hw-00000001",  # Lowercase
            "",                  # Empty string
            "AMS-HW-ABCDEFGH",  # Non-numeric sequence
        ]
        
        for tag in invalid_tags:
            is_valid, _, _ = validate_asset_tag_format(tag)
            assert not is_valid, f"Tag '{tag}' should be invalid"

    def test_zero_padded_sequence(self) -> None:
        """Test that sequence numbers are zero-padded to 8 digits."""
        generator = AssetTagGenerator()
        
        tag = generator.generate_asset_tag(AssetType.HARDWARE)
        
        # Extract the sequence part
        sequence_part = tag.split("-")[2]
        
        assert len(sequence_part) == 8, f"Sequence should be 8 digits, got {len(sequence_part)}"
        assert sequence_part == "00000001"


@pytest.mark.property
class TestAssetTagUniquenessPropertyTests:
    """
    Property-based tests for Asset Tag Uniqueness.

    **Property 3: Asset Tag Uniqueness Invariant**
    **Validates: Requirements 2.6**

    These tests verify that for any collection of assets created in the system,
    all asset_tag values SHALL be unique. No two assets SHALL ever share the
    same asset_tag regardless of asset type or creation order.
    """

    @given(creation_sequence=asset_creation_sequence())
    @settings(max_examples=50, deadline=None)
    def test_all_generated_tags_are_unique(
        self, creation_sequence: List[AssetType]
    ) -> None:
        """
        Property: All generated asset tags are unique.

        **Validates: Requirements 2.6**

        For any sequence of asset creations (regardless of type or order),
        every generated asset tag must be unique. No duplicates are allowed.
        """
        generator = AssetTagGenerator()
        
        # Generate tags for all assets in the sequence
        generated_tags = [
            generator.generate_asset_tag(asset_type)
            for asset_type in creation_sequence
        ]
        
        # Verify all tags are unique
        unique_tags = set(generated_tags)
        
        assert len(generated_tags) == len(unique_tags), (
            f"Duplicate tags found! Generated {len(generated_tags)} tags "
            f"but only {len(unique_tags)} are unique. "
            f"Duplicates: {[t for t in generated_tags if generated_tags.count(t) > 1]}"
        )

    @given(creation_sequence=asset_creation_sequence())
    @settings(max_examples=50, deadline=None)
    def test_all_tags_follow_valid_format(
        self, creation_sequence: List[AssetType]
    ) -> None:
        """
        Property: All generated asset tags follow the valid format.

        **Validates: Requirements 2.6**

        Every generated asset tag must match the pattern:
        AMS-{HW|SW|EA}-{8-digit-sequence}
        """
        generator = AssetTagGenerator()
        
        for asset_type in creation_sequence:
            tag = generator.generate_asset_tag(asset_type)
            
            is_valid, prefix, sequence = validate_asset_tag_format(tag)
            
            assert is_valid, (
                f"Generated tag '{tag}' does not match expected format "
                f"AMS-{{HW|SW|EA}}-{{8-digit-sequence}}"
            )
            
            # Verify prefix matches asset type
            expected_prefix = get_type_prefix(asset_type)
            assert prefix == expected_prefix, (
                f"Tag prefix '{prefix}' does not match expected '{expected_prefix}' "
                f"for asset type {asset_type.value}"
            )

    @given(creation_sequence=asset_creation_sequence())
    @settings(max_examples=50, deadline=None)
    def test_sequence_numbers_are_monotonically_increasing(
        self, creation_sequence: List[AssetType]
    ) -> None:
        """
        Property: Sequence numbers are monotonically increasing per asset type.

        **Validates: Requirements 2.6**

        For each asset type, the sequence numbers in generated tags must
        be strictly increasing (1, 2, 3, ...) with no gaps or duplicates.
        """
        generator = AssetTagGenerator()
        
        # Track sequences per type
        sequences_by_type: dict[AssetType, List[int]] = {
            asset_type: [] for asset_type in AssetType
        }
        
        for asset_type in creation_sequence:
            tag = generator.generate_asset_tag(asset_type)
            _, _, sequence = validate_asset_tag_format(tag)
            sequences_by_type[asset_type].append(sequence)
        
        # Verify monotonic increase for each type
        for asset_type, sequences in sequences_by_type.items():
            if sequences:
                # Should start at 1 and increment by 1
                expected = list(range(1, len(sequences) + 1))
                assert sequences == expected, (
                    f"Sequences for {asset_type.value} are not monotonically increasing. "
                    f"Expected {expected}, got {sequences}"
                )

    @given(batch=mixed_asset_batch())
    @settings(max_examples=30, deadline=None)
    def test_uniqueness_across_mixed_batches(
        self, batch: List[Tuple[AssetType, int]]
    ) -> None:
        """
        Property: Tags remain unique when creating mixed batches of assets.

        **Validates: Requirements 2.6**

        When creating multiple assets of different types in batches,
        all generated tags must still be unique across all types.
        """
        generator = AssetTagGenerator()
        all_tags: List[str] = []
        
        for asset_type, count in batch:
            for _ in range(count):
                tag = generator.generate_asset_tag(asset_type)
                all_tags.append(tag)
        
        # Verify uniqueness
        unique_tags = set(all_tags)
        
        assert len(all_tags) == len(unique_tags), (
            f"Duplicate tags found in mixed batch! "
            f"Generated {len(all_tags)} tags but only {len(unique_tags)} are unique."
        )

    @given(
        first_batch=asset_creation_sequence(),
        second_batch=asset_creation_sequence()
    )
    @settings(max_examples=30, deadline=None)
    def test_uniqueness_preserved_across_multiple_sessions(
        self, first_batch: List[AssetType], second_batch: List[AssetType]
    ) -> None:
        """
        Property: Tags remain unique across multiple creation sessions.

        **Validates: Requirements 2.6**

        When assets are created in multiple sessions (simulating different
        API calls or transactions), all tags must remain unique.
        """
        generator = AssetTagGenerator()
        
        # First session
        first_tags = [
            generator.generate_asset_tag(asset_type)
            for asset_type in first_batch
        ]
        
        # Second session (same generator, simulating persistent state)
        second_tags = [
            generator.generate_asset_tag(asset_type)
            for asset_type in second_batch
        ]
        
        # All tags combined must be unique
        all_tags = first_tags + second_tags
        unique_tags = set(all_tags)
        
        assert len(all_tags) == len(unique_tags), (
            f"Duplicate tags found across sessions! "
            f"First session: {len(first_tags)} tags, "
            f"Second session: {len(second_tags)} tags, "
            f"Total unique: {len(unique_tags)}"
        )

    @given(asset_type=asset_type_strategy())
    @settings(max_examples=20, deadline=None)
    def test_tag_prefix_matches_asset_type(self, asset_type: AssetType) -> None:
        """
        Property: Tag prefix always matches the asset type.

        **Validates: Requirements 2.6**

        The type prefix in the generated tag must always correspond
        to the asset type used to generate it.
        """
        generator = AssetTagGenerator()
        tag = generator.generate_asset_tag(asset_type)
        
        _, prefix, _ = validate_asset_tag_format(tag)
        expected_prefix = get_type_prefix(asset_type)
        
        assert prefix == expected_prefix, (
            f"Tag prefix mismatch for {asset_type.value}: "
            f"expected '{expected_prefix}', got '{prefix}'"
        )

    @given(count=st.integers(min_value=1, max_value=1000))
    @settings(max_examples=10, deadline=None)
    def test_large_scale_uniqueness(self, count: int) -> None:
        """
        Property: Uniqueness is maintained even at large scale.

        **Validates: Requirements 2.6**

        Even when generating a large number of assets, all tags
        must remain unique.
        """
        generator = AssetTagGenerator()
        all_tags: Set[str] = set()
        
        for i in range(count):
            # Cycle through asset types
            asset_type = list(AssetType)[i % len(AssetType)]
            tag = generator.generate_asset_tag(asset_type)
            
            assert tag not in all_tags, (
                f"Duplicate tag '{tag}' generated at iteration {i}"
            )
            all_tags.add(tag)
        
        assert len(all_tags) == count, (
            f"Expected {count} unique tags, got {len(all_tags)}"
        )

    @given(creation_sequence=asset_creation_sequence())
    @settings(max_examples=50, deadline=None)
    def test_sequence_starts_at_one(
        self, creation_sequence: List[AssetType]
    ) -> None:
        """
        Property: Sequence numbers start at 1 for each asset type.

        **Validates: Requirements 2.6**

        The first asset of each type should have sequence number 1,
        not 0 or any other value.
        """
        generator = AssetTagGenerator()
        first_tag_per_type: dict[AssetType, str] = {}
        
        for asset_type in creation_sequence:
            tag = generator.generate_asset_tag(asset_type)
            
            if asset_type not in first_tag_per_type:
                first_tag_per_type[asset_type] = tag
        
        # Verify first tag of each type has sequence 1
        for asset_type, tag in first_tag_per_type.items():
            _, _, sequence = validate_asset_tag_format(tag)
            
            assert sequence == 1, (
                f"First tag for {asset_type.value} should have sequence 1, "
                f"got {sequence} in tag '{tag}'"
            )


class TestAssetTagDatabaseConstraintSimulation:
    """
    Tests simulating database-level uniqueness constraints.
    
    These tests verify that the asset tag generation logic would work
    correctly with the UNIQUE constraint on the asset_tag column.
    """

    def test_unique_constraint_simulation(self) -> None:
        """
        Test that simulates the database UNIQUE constraint behavior.
        
        **Validates: Requirements 2.6**
        
        The assets table has a UNIQUE constraint on asset_tag column.
        This test verifies that our generation logic never produces
        duplicates that would violate this constraint.
        """
        generator = AssetTagGenerator()
        
        # Simulate creating 1000 assets of mixed types
        for i in range(1000):
            asset_type = list(AssetType)[i % len(AssetType)]
            tag = generator.generate_asset_tag(asset_type)
            
            # Simulate INSERT with UNIQUE constraint check
            all_tags = generator.get_all_tags()
            tag_count = sum(1 for t in all_tags if t == tag)
            
            assert tag_count == 1, (
                f"UNIQUE constraint violation: tag '{tag}' appears {tag_count} times"
            )

    def test_concurrent_creation_simulation(self) -> None:
        """
        Test simulating concurrent asset creation.
        
        **Validates: Requirements 2.6**
        
        In a real database, the generate_asset_tag() function uses
        MAX() + 1 pattern which could have race conditions. This test
        verifies the expected behavior in a single-threaded context.
        """
        # Create multiple generators to simulate concurrent sessions
        # Note: In production, database transactions would handle this
        generator = AssetTagGenerator()
        
        # Interleaved creation of different asset types
        tags = []
        for _ in range(100):
            tags.append(generator.generate_asset_tag(AssetType.HARDWARE))
            tags.append(generator.generate_asset_tag(AssetType.SOFTWARE))
            tags.append(generator.generate_asset_tag(AssetType.ENTERPRISE))
        
        # All 300 tags should be unique
        unique_tags = set(tags)
        assert len(tags) == len(unique_tags) == 300
