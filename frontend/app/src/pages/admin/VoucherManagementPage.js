import React, { useState, useEffect, useCallback } from 'react';
import {
    Container,
    Row,
    Col,
    Button,
    Table,
    Modal,
    Form,
    Alert,
    Spinner // For loading state
} from 'react-bootstrap';
import { fetchWithAuth } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
// import './VoucherManagementPage.css'; // Minimal CSS needed, if any

const VoucherManagementPage = () => {
    const { token } = useAuth();
    const [vouchers, setVouchers] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [voucherPrefix, setVoucherPrefix] = useState('');
    const [voucherMaxRuns, setVoucherMaxRuns] = useState(1);
    const [voucherIsActive, setVoucherIsActive] = useState(true);
    const [voucherBatchLabel, setVoucherBatchLabel] = useState('');
    const [voucherCount, setVoucherCount] = useState(10);
    const [voucherExpiresAt, setVoucherExpiresAt] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [filterBatch, setFilterBatch] = useState('');

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuth('/v1/vouchers/', { method: 'GET' });
            setVouchers(data);
        } catch (err) {
            console.error("Failed to fetch vouchers:", err);
            setError(err.message || "Failed to fetch vouchers.");
        }
        setIsLoading(false);
    }, []);

    useEffect(() => {
        if (token) { // Fetch vouchers only if admin is logged in
            fetchVouchers();
        }
    }, [fetchVouchers, token]);

    const handleShowModal = (voucher = null) => {
        setEditingVoucher(voucher);
        if (voucher) {
            setVoucherPrefix(voucher.prefix || '');
            setVoucherMaxRuns(voucher.max_runs);
            setVoucherIsActive(voucher.is_active);
        } else {
            setVoucherPrefix('');
            setVoucherMaxRuns(1);
            setVoucherIsActive(true);
        }
        setError(null); // Clear form-specific errors
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingVoucher(null);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true); // Consider a specific submitting state for the form
        setError(null);

        const voucherPayload = {
            prefix: voucherPrefix || null,
            batch_label: voucherBatchLabel || null,
            max_runs: parseInt(voucherMaxRuns, 10),
            is_active: voucherIsActive,
            expires_at: voucherExpiresAt ? new Date(voucherExpiresAt).toISOString() : null,
        };

        try {
            if (editingVoucher) {
                const updatePayload = {};
                // Only include fields that have actually changed for PUT
                if (voucherMaxRuns !== editingVoucher.max_runs) updatePayload.max_runs = parseInt(voucherMaxRuns, 10);
                if (voucherIsActive !== editingVoucher.is_active) updatePayload.is_active = voucherIsActive;
                // Prefix is not editable, so not included here

                if (Object.keys(updatePayload).length > 0) {
                    await fetchWithAuth(`/v1/vouchers/${editingVoucher.id}`, {
                        method: 'PUT',
                        body: JSON.stringify(updatePayload),
                    });
                } else {
                    // No changes, just close modal
                    handleCloseModal();
                    setIsLoading(false);
                    return;
                }
            } else {
                // Use batch creation if count > 1
                if (voucherCount && Number(voucherCount) > 1) {
                    const batchPayload = {
                        prefix: voucherPayload.prefix,
                        batch_label: voucherPayload.batch_label,
                        count: parseInt(voucherCount, 10),
                        max_runs: voucherPayload.max_runs,
                        is_active: voucherPayload.is_active,
                        expires_at: voucherPayload.expires_at,
                    };
                    await fetchWithAuth('/v1/vouchers/batch', {
                        method: 'POST',
                        body: JSON.stringify(batchPayload),
                    });
                } else {
                    await fetchWithAuth('/v1/vouchers/', {
                        method: 'POST',
                        body: JSON.stringify(voucherPayload),
                    });
                }
            }
            fetchVouchers();
            handleCloseModal();
        } catch (err) {
            console.error("Failed to save voucher:", err);
            setError(err.message || "Failed to save voucher."); // Show error in modal or page
        }
        setIsLoading(false);
    };

    // Filtering and selection helpers
    const filteredVouchers = vouchers.filter(v => {
        if (!filterBatch.trim()) return true;
        return (v.batch_label || '').toLowerCase().includes(filterBatch.trim().toLowerCase());
    });

    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const toggleSelectAllFiltered = () => {
        const filteredIds = filteredVouchers.map(v => v.id);
        const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !filteredIds.includes(id)));
        } else {
            const set = new Set([...selectedIds, ...filteredIds]);
            setSelectedIds(Array.from(set));
        }
    };

    const bulkDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Delete ${selectedIds.length} selected voucher(s)?`)) return;
        setIsLoading(true);
        setError(null);
        try {
            const qs = encodeURIComponent(selectedIds.join(','));
            await fetchWithAuth(`/v1/vouchers/?ids=${qs}`, { method: 'DELETE' });
            setSelectedIds([]);
            await fetchVouchers();
        } catch (err) {
            console.error('Bulk delete failed:', err);
            setError(err.message || 'Bulk delete failed.');
        }
        setIsLoading(false);
    };

    const deleteBatch = async (batchLabel) => {
        if (!batchLabel) return;
        if (!window.confirm(`Delete all vouchers in batch '${batchLabel}'?`)) return;
        setIsLoading(true);
        setError(null);
        try {
            await fetchWithAuth(`/v1/vouchers/by-batch/${encodeURIComponent(batchLabel)}`, { method: 'DELETE' });
            setSelectedIds([]);
            await fetchVouchers();
        } catch (err) {
            console.error('Delete batch failed:', err);
            setError(err.message || 'Delete batch failed.');
        }
        setIsLoading(false);
    };

    const handleDeleteVoucher = async (voucherId) => {
        if (window.confirm("Are you sure you want to delete this voucher?")) {
            setIsLoading(true); // Consider a specific deleting state
            setError(null);
            try {
                await fetchWithAuth(`/v1/vouchers/${voucherId}`, { method: 'DELETE' });
                fetchVouchers();
            } catch (err) {
                console.error("Failed to delete voucher:", err);
                setError(err.message || "Failed to delete voucher.");
            }
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <Container className="mt-5">
                <Alert variant="warning">Please log in as an admin to manage vouchers.</Alert>
            </Container>
        );
    }

    return (
        <Container fluid className="p-4">
            <Row className="mb-3">
                <Col>
                    <h1>Voucher Management</h1>
                </Col>
                <Col className="text-end">
                    <Button variant="primary" onClick={() => handleShowModal()}>
                        Create New Voucher
                    </Button>
                    {' '}
                    <Button variant="outline-secondary" onClick={() => {
                        // Simple CSV export of current table
                        const header = ['code','prefix','batch_label','max_runs','used_runs','remaining_runs','is_active','expires_at','created_at'];
                        const rows = vouchers.map(v => [
                            v.code,
                            v.prefix || '',
                            v.batch_label || '',
                            v.max_runs,
                            v.used_runs,
                            (v.max_runs - v.used_runs),
                            v.is_active ? 'yes' : 'no',
                            v.expires_at ? new Date(v.expires_at).toISOString() : '',
                            v.created_at ? new Date(v.created_at).toISOString() : ''
                        ]);
                        const csv = [header, ...rows].map(r => r.map(x => `"${String(x).replaceAll('"','""')}"`).join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `vouchers_${new Date().toISOString().slice(0,10)}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                    }} className="ms-2">
                        Export CSV
                    </Button>
                </Col>
            </Row>

            <Row className="mb-3">
                <Col md={6}>
                    <Form.Group controlId="filterBatch">
                        <Form.Label>Filter op Batch label</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="bv. Klas A"
                            value={filterBatch}
                            onChange={(e) => setFilterBatch(e.target.value)}
                            disabled={isLoading}
                        />
                    </Form.Group>
                </Col>
                <Col className="text-end align-self-end">
                    <Button
                        variant="outline-danger"
                        className="me-2"
                        disabled={selectedIds.length === 0 || isLoading}
                        onClick={bulkDeleteSelected}
                    >
                        Bulk delete geselecteerde
                    </Button>
                    <Button
                        variant="outline-danger"
                        disabled={!filterBatch.trim() || isLoading}
                        onClick={() => deleteBatch(filterBatch.trim())}
                    >
                        Delete hele batch
                    </Button>
                </Col>
            </Row>

            {error && !showModal && <Alert variant="danger">{error}</Alert>} {/* Page level error, not for modal error which is inside modal */}
            
            {isLoading && !showModal ? (
                <div className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            ) : filteredVouchers.length > 0 ? (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th style={{width: '36px'}}>
                                <Form.Check
                                    type="checkbox"
                                    checked={filteredVouchers.length > 0 && filteredVouchers.every(v => selectedIds.includes(v.id))}
                                    onChange={toggleSelectAllFiltered}
                                    disabled={isLoading}
                                />
                            </th>
                            <th>Code</th>
                            <th>Prefix</th>
                            <th>Batch</th>
                            <th>Max Runs</th>
                            <th>Used Runs</th>
                            <th>Remaining Runs</th>
                            <th>Active</th>
                            <th>Expires</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredVouchers.map(voucher => (
                            <tr key={voucher.id}>
                                <td>
                                    <Form.Check
                                        type="checkbox"
                                        checked={selectedIds.includes(voucher.id)}
                                        onChange={() => toggleSelect(voucher.id)}
                                        disabled={isLoading}
                                    />
                                </td>
                                <td>{voucher.code}</td>
                                <td>{voucher.prefix || 'N/A'}</td>
                                <td>{voucher.batch_label || '—'}</td>
                                <td>{voucher.max_runs}</td>
                                <td>{voucher.used_runs}</td>
                                <td>{voucher.remaining_runs}</td>
                                <td>{voucher.is_active ? 'Yes' : 'No'}</td>
                                <td>{voucher.expires_at ? new Date(voucher.expires_at).toLocaleString() : '—'}</td>
                                <td>{new Date(voucher.created_at).toLocaleDateString()}</td>
                                <td>
                                    <Button variant="info" size="sm" onClick={() => handleShowModal(voucher)} className="me-2">
                                        Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteVoucher(voucher.id)} disabled={isLoading}>
                                        Delete
                                    </Button>
                                    {' '}
                                    {voucher.batch_label && (
                                        <Button variant="outline-danger" size="sm" onClick={() => deleteBatch(voucher.batch_label)} disabled={isLoading} className="ms-2">
                                            Delete batch
                                        </Button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            ) : (
                !isLoading && <Alert variant="info">No vouchers found. Click 'Create New Voucher' to add one.</Alert>
            )}

            <Modal show={showModal} onHide={handleCloseModal} backdrop="static" keyboard={false}>
                <Modal.Header closeButton>
                    <Modal.Title>{editingVoucher ? 'Edit Voucher' : 'Create New Voucher'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {error && <Alert variant="danger">{error}</Alert>} {/* Modal specific error */} 
                    <Form onSubmit={handleFormSubmit}>
                        <Form.Group className="mb-3" controlId="voucherPrefix">
                            <Form.Label>Prefix (Optional)</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={voucherPrefix} 
                                onChange={(e) => setVoucherPrefix(e.target.value)} 
                                disabled={!!editingVoucher || isLoading} 
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="voucherBatchLabel">
                            <Form.Label>Batch label (bv. klasnaam)</Form.Label>
                            <Form.Control 
                                type="text" 
                                value={voucherBatchLabel} 
                                onChange={(e) => setVoucherBatchLabel(e.target.value)} 
                                disabled={isLoading} 
                            />
                        </Form.Group>
                        {!editingVoucher && (
                            <Form.Group className="mb-3" controlId="voucherCount">
                                <Form.Label>Aantal vouchers</Form.Label>
                                <Form.Control 
                                    type="number" 
                                    value={voucherCount} 
                                    onChange={(e) => setVoucherCount(e.target.value)} 
                                    min="1" 
                                    required 
                                    disabled={isLoading}
                                />
                            </Form.Group>
                        )}
                        <Form.Group className="mb-3" controlId="voucherMaxRuns">
                            <Form.Label>Max Runs</Form.Label>
                            <Form.Control 
                                type="number" 
                                value={voucherMaxRuns} 
                                onChange={(e) => setVoucherMaxRuns(e.target.value)} 
                                min="0" 
                                required 
                                disabled={isLoading}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="voucherExpiresAt">
                            <Form.Label>Vervaldatum</Form.Label>
                            <Form.Control 
                                type="datetime-local" 
                                value={voucherExpiresAt} 
                                onChange={(e) => setVoucherExpiresAt(e.target.value)} 
                                disabled={isLoading}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="voucherIsActive">
                            <Form.Check 
                                type="checkbox" 
                                label="Active"
                                checked={voucherIsActive} 
                                onChange={(e) => setVoucherIsActive(e.target.checked)} 
                                disabled={isLoading}
                            />
                        </Form.Group>
                        <div className="d-flex justify-content-end">
                            <Button variant="secondary" onClick={handleCloseModal} className="me-2" disabled={isLoading}>
                                Cancel
                            </Button>
                            <Button variant="primary" type="submit" disabled={isLoading}>
                                {isLoading ? <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> : (editingVoucher ? 'Save Changes' : 'Create Voucher')}
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container>
    );
};

export default VoucherManagementPage; 