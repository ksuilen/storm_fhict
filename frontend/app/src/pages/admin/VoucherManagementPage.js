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

    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchWithAuth('/api/v1/vouchers/', { method: 'GET' });
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
            max_runs: parseInt(voucherMaxRuns, 10),
            is_active: voucherIsActive,
        };

        try {
            if (editingVoucher) {
                const updatePayload = {};
                // Only include fields that have actually changed for PUT
                if (voucherMaxRuns !== editingVoucher.max_runs) updatePayload.max_runs = parseInt(voucherMaxRuns, 10);
                if (voucherIsActive !== editingVoucher.is_active) updatePayload.is_active = voucherIsActive;
                // Prefix is not editable, so not included here

                if (Object.keys(updatePayload).length > 0) {
                    await fetchWithAuth(`/api/v1/vouchers/${editingVoucher.id}`, {
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
                await fetchWithAuth('/api/v1/vouchers/', {
                    method: 'POST',
                    body: JSON.stringify(voucherPayload),
                });
            }
            fetchVouchers();
            handleCloseModal();
        } catch (err) {
            console.error("Failed to save voucher:", err);
            setError(err.message || "Failed to save voucher."); // Show error in modal or page
        }
        setIsLoading(false);
    };

    const handleDeleteVoucher = async (voucherId) => {
        if (window.confirm("Are you sure you want to delete this voucher?")) {
            setIsLoading(true); // Consider a specific deleting state
            setError(null);
            try {
                await fetchWithAuth(`/api/v1/vouchers/${voucherId}`, { method: 'DELETE' });
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
                </Col>
            </Row>

            {error && !showModal && <Alert variant="danger">{error}</Alert>} {/* Page level error, not for modal error which is inside modal */}
            
            {isLoading && !showModal ? (
                <div className="text-center">
                    <Spinner animation="border" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </Spinner>
                </div>
            ) : vouchers.length > 0 ? (
                <Table striped bordered hover responsive>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Prefix</th>
                            <th>Max Runs</th>
                            <th>Used Runs</th>
                            <th>Remaining Runs</th>
                            <th>Active</th>
                            <th>Created At</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {vouchers.map(voucher => (
                            <tr key={voucher.id}>
                                <td>{voucher.code}</td>
                                <td>{voucher.prefix || 'N/A'}</td>
                                <td>{voucher.max_runs}</td>
                                <td>{voucher.used_runs}</td>
                                <td>{voucher.remaining_runs}</td>
                                <td>{voucher.is_active ? 'Yes' : 'No'}</td>
                                <td>{new Date(voucher.created_at).toLocaleDateString()}</td>
                                <td>
                                    <Button variant="info" size="sm" onClick={() => handleShowModal(voucher)} className="me-2">
                                        Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDeleteVoucher(voucher.id)} disabled={isLoading}>
                                        Delete
                                    </Button>
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