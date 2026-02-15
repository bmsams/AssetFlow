import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssetAttachments } from './AssetAttachments';
import { mockHardwareAssetDetail } from './mockData';

describe('AssetAttachments', () => {
  const mockAttachments = mockHardwareAssetDetail.attachments;

  it('renders attachments header with count', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText(`(${mockAttachments.length})`)).toBeInTheDocument();
  });

  it('renders add button', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    expect(screen.getByLabelText('Add attachment')).toBeInTheDocument();
  });

  it('renders empty state when no attachments', () => {
    render(<AssetAttachments attachments={[]} />);
    expect(screen.getByText('No attachments')).toBeInTheDocument();
    expect(screen.getByText('Upload documents, images, or other files related to this asset')).toBeInTheDocument();
  });

  it('renders attachment file names', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    expect(screen.getByText('purchase_invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('warranty_certificate.pdf')).toBeInTheDocument();
    expect(screen.getByText('asset_photo.jpg')).toBeInTheDocument();
    expect(screen.getByText('configuration_guide.docx')).toBeInTheDocument();
  });

  it('renders file sizes', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    // File sizes are formatted (e.g., "245 KB", "1.25 MB")
    expect(screen.getByText('239.26 KB')).toBeInTheDocument(); // 245000 bytes
    expect(screen.getByText('1.19 MB')).toBeInTheDocument(); // 1250000 bytes
  });

  it('renders upload dates', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    // Dates are formatted
    const dateElements = screen.getAllByText(/\w+ \d+, \d{4}/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('renders uploader names', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    const uploaderNames = screen.getAllByText('John Smith');
    expect(uploaderNames.length).toBe(mockAttachments.length);
  });

  it('renders file descriptions', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    expect(screen.getByText('Original purchase invoice')).toBeInTheDocument();
    expect(screen.getByText('Warranty certificate from manufacturer')).toBeInTheDocument();
    expect(screen.getByText('Photo of asset at deployment')).toBeInTheDocument();
    expect(screen.getByText('Configuration and setup guide')).toBeInTheDocument();
  });

  it('calls onDownload when attachment card is clicked', () => {
    const onDownload = vi.fn();
    render(<AssetAttachments attachments={mockAttachments} onDownload={onDownload} />);
    
    fireEvent.click(screen.getByLabelText('Download purchase_invoice.pdf'));
    expect(onDownload).toHaveBeenCalledWith(mockAttachments[0]);
  });

  it('calls onAddAttachment when add button is clicked', () => {
    const onAddAttachment = vi.fn();
    render(<AssetAttachments attachments={mockAttachments} onAddAttachment={onAddAttachment} />);
    
    fireEvent.click(screen.getByLabelText('Add attachment'));
    expect(onAddAttachment).toHaveBeenCalledTimes(1);
  });

  it('renders delete buttons when onDeleteAttachment is provided', () => {
    const onDeleteAttachment = vi.fn();
    render(<AssetAttachments attachments={mockAttachments} onDeleteAttachment={onDeleteAttachment} />);
    
    const deleteButtons = screen.getAllByLabelText(/Delete/);
    expect(deleteButtons.length).toBe(mockAttachments.length);
  });

  it('calls onDeleteAttachment when delete button is clicked', () => {
    const onDeleteAttachment = vi.fn();
    render(<AssetAttachments attachments={mockAttachments} onDeleteAttachment={onDeleteAttachment} />);
    
    fireEvent.click(screen.getByLabelText('Delete purchase_invoice.pdf'));
    expect(onDeleteAttachment).toHaveBeenCalledWith(mockAttachments[0].attachmentId);
  });

  it('does not render delete buttons when onDeleteAttachment is not provided', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    const deleteButtons = screen.queryAllByLabelText(/Delete/);
    expect(deleteButtons.length).toBe(0);
  });

  it('renders loading skeleton when isLoading is true', () => {
    render(<AssetAttachments attachments={mockAttachments} isLoading={true} />);
    
    // Should have aria-busy attribute on the container
    const container = document.querySelector('[aria-busy="true"]');
    expect(container).toBeInTheDocument();
    
    // Should not render actual attachments
    expect(screen.queryByText('purchase_invoice.pdf')).not.toBeInTheDocument();
  });

  it('renders appropriate file icons based on file type', () => {
    render(<AssetAttachments attachments={mockAttachments} />);
    
    // Each attachment card should have an icon
    const attachmentCards = screen.getAllByRole('button', { name: /Download/ });
    expect(attachmentCards.length).toBe(mockAttachments.length);
  });
});

describe('AssetAttachments - Accessibility', () => {
  it('has accessible labels for all interactive elements', () => {
    const onDeleteAttachment = vi.fn();
    render(<AssetAttachments attachments={mockHardwareAssetDetail.attachments} onDeleteAttachment={onDeleteAttachment} />);
    
    // Add button
    expect(screen.getByLabelText('Add attachment')).toBeInTheDocument();
    
    // Download buttons (attachment cards)
    mockHardwareAssetDetail.attachments.forEach((attachment) => {
      expect(screen.getByLabelText(`Download ${attachment.fileName}`)).toBeInTheDocument();
    });
    
    // Delete buttons
    mockHardwareAssetDetail.attachments.forEach((attachment) => {
      expect(screen.getByLabelText(`Delete ${attachment.fileName}`)).toBeInTheDocument();
    });
  });
});
