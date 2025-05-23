import React, { useState, useEffect } from 'react';
// import { Link, useNavigate, useLocation } from 'react-router-dom'; // Link is niet gebruikt
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchWithAuth } from '../services/apiService'; // CORRECTED IMPORT
import {
    Container,
    Row,
    Col,
    Form,
    Button,
    Alert,
    Nav // For the Admin/Voucher toggle
} from 'react-bootstrap';
import './LoginPage.css';

function LoginPage() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loginType, setLoginType] = useState('admin'); // 'admin' or 'voucher'
    const [email, setEmail] = useState('admin@example.com');
    const [password, setPassword] = useState('Password');
    const [voucherCode, setVoucherCode] = useState('');
    const { login, error, setError, user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Als er een bericht is vanuit de state (bv. na redirect van ProtectedRoute), wis het na tonen
        if (location.state?.message) {
            const state = { ...location.state };
            delete state.message;
            navigate(location.pathname, { state, replace: true });
        }

        // Als gebruiker al ingelogd is en op /login komt, stuur naar dashboard
        if (user) {
            navigate('/dashboard', { replace: true });
        }

        // Wis de error van useAuth context als de component mount
        // zodat oude errors niet getoond worden.
        setError(null);

    }, [user, navigate, location, setError]);

    const handleLogin = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setError('');

        if (loginType === 'admin') {
            const body = new URLSearchParams();
            body.append('username', email);
            body.append('password', password);

            try {
                const data = await fetchWithAuth('/api/v1/login/access-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: body,
                });
                login(data.access_token); 
                navigate('/dashboard');
            } catch (err) {
                console.error("Admin login error:", err);
                setError(err.message || 'Failed to login as admin. Please check credentials.');
            }
        } else { // Voucher login
            try {
                const data = await fetchWithAuth('/api/v1/login/voucher', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ voucher_code: voucherCode }),
                });
                login(data.access_token);
                navigate('/dashboard'); 
            } catch (err) {
                console.error("Voucher login error:", err);
                setError(err.message || 'Failed to login with voucher. Please check the code and try again.');
            }
        }
        setIsSubmitting(false);
    };

    return (
        <Container fluid className="login-page-container d-flex align-items-center justify-content-center">
            <Row className="w-100 justify-content-center">
                <Col md={6} lg={4} className="p-4 bg-light rounded shadow login-form-col">
                    <h2 className="text-center mb-4">{loginType === 'admin' ? 'Admin Login' : 'Voucher Login'}</h2>
                    
                    <Nav variant="pills" activeKey={loginType} onSelect={(k) => setLoginType(k)} className="mb-3 nav-fill">
                        <Nav.Item>
                            <Nav.Link eventKey="admin" disabled={isSubmitting}>Admin</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="voucher" disabled={isSubmitting}>Voucher</Nav.Link>
                        </Nav.Item>
                    </Nav>

                    {error && <Alert variant="danger">{error}</Alert>}

                    <Form onSubmit={handleLogin}>
                        {loginType === 'admin' ? (
                            <>
                                <Form.Group className="mb-3" controlId="email">
                                    <Form.Label>Email address</Form.Label>
                                    <Form.Control
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                        placeholder="Enter email"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3" controlId="password">
                                    <Form.Label>Password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={isSubmitting}
                                        placeholder="Password"
                                    />
                                </Form.Group>
                            </>
                        ) : (
                            <Form.Group className="mb-3" controlId="voucherCode">
                                <Form.Label>Voucher Code</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={voucherCode}
                                    onChange={(e) => setVoucherCode(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                    placeholder="Enter voucher code"
                                />
                            </Form.Group>
                        )}
                        <Button variant="primary" type="submit" className="w-100" disabled={isSubmitting}>
                            {isSubmitting ? 'Logging in...' : 'Login'}
                        </Button>
                    </Form>
                </Col>
            </Row>
        </Container>
    );
}

export default LoginPage; 