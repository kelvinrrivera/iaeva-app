import { test, expect } from '@playwright/test';

test.describe('Flujo de Cancelación de Citas por IA (WhatsApp)', () => {
    // Nota: Este test simula la llamada a la ruta /api/whatsapp/webhook como lo haría Meta

    test('debería cancelar exitosamente una cita existente enviando un mensaje', async ({ request }) => {
        // 1. Preparar datos de prueba (usando test mode y una cita mockeada)
        const testPhoneNumber = '18095551234';
        const testMessage = 'Me surgió un imprevisto, quiero cancelar mi cita de mañana';

        // 2. Simular payload de Meta Webhook (POST /api/whatsapp/webhook)
        const payload = {
            object: 'whatsapp_business_account',
            entry: [{
                id: '12345',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '18095550000', // Business phone number
                            phone_number_id: '123456789'
                        },
                        contacts: [{
                            profile: { name: 'Cliente de Prueba' },
                            wa_id: testPhoneNumber
                        }],
                        messages: [{
                            from: testPhoneNumber,
                            id: 'wamid.HBgLMTg...',
                            timestamp: Date.now().toString(),
                            text: { body: testMessage },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        };

        // 3. Ejecutar webhook de entrada de mensaje
        const response = await request.post('/api/whatsapp/webhook', {
            data: payload,
            // Se requiere firmar el payload si la protección está activa en entorno real
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // Validar recepción exitosa por la API
        expect(response.status()).toBe(200);
        const result = await response.json();
        expect(result.success).toBe(true);

        // TODO: En un test completo E2E, se debería consultar la DB para confirmar 
        // que el `AppointmentStatus` cambió a 'CANCELLED'
    });
});
