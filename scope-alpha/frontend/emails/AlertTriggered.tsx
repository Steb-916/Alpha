import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Row,
  Column,
} from '@react-email/components';

interface Props {
  alertName: string;
  asset: string;
  type: string;
  condition: string;
  threshold: number;
  actualValue: number;
}

export function AlertTriggeredEmail({
  alertName,
  asset,
  type,
  condition,
  threshold,
  actualValue,
}: Props) {
  const label = (s: string) => s.replace(/_/g, ' ');

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#0a0a0f', fontFamily: 'monospace' }}>
        <Container style={{ maxWidth: '520px', margin: '40px auto', padding: '0 20px' }}>
          <Section
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              padding: '32px',
            }}
          >
            <Text style={{ color: '#00d4aa', fontSize: '11px', letterSpacing: '0.1em', margin: '0 0 16px' }}>
              SCOPE ALPHA — ALERT
            </Text>

            <Heading
              style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700, margin: '0 0 8px' }}
            >
              {alertName}
            </Heading>

            <Text style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 24px' }}>
              Your alert was triggered for <strong style={{ color: '#d1d5db' }}>{asset}</strong>.
            </Text>

            <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '0 0 24px' }} />

            <Row style={{ marginBottom: '12px' }}>
              <Column style={{ width: '50%' }}>
                <Text style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metric</Text>
                <Text style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>{label(type)}</Text>
              </Column>
              <Column style={{ width: '50%' }}>
                <Text style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Condition</Text>
                <Text style={{ color: '#d1d5db', fontSize: '14px', margin: 0 }}>{label(condition)} {threshold}</Text>
              </Column>
            </Row>

            <Section
              style={{
                background: 'rgba(0,212,170,0.08)',
                border: '1px solid rgba(0,212,170,0.2)',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '16px',
              }}
            >
              <Text style={{ color: '#6b7280', fontSize: '11px', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actual Value</Text>
              <Text style={{ color: '#00d4aa', fontSize: '24px', fontWeight: 700, margin: 0 }}>
                {actualValue.toFixed(4)}
              </Text>
            </Section>

            <Hr style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '24px 0 16px' }} />

            <Text style={{ color: '#4b5563', fontSize: '11px', margin: 0 }}>
              Scope Alpha · Not financial advice · Unsubscribe in Settings → Alerts
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
