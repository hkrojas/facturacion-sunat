# backend/calculations.py
# ARCHIVO CORREGIDO (ESTRATEGIA INVERSA PARA VALIDACIÓN ESTRICTA SUNAT)
# Ajuste clave: El Valor Unitario (Payload) se recalcula desde el Valor Venta Total / Cantidad
# para garantizar que Cantidad * ValorUnitario == ValorVenta sin errores de redondeo.

from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import List, Union, Dict, Any

# Ajustar la precisión global para operaciones con Decimal
getcontext().prec = 50

# --- CONSTANTES DE CÁLCULO ---
# 10 decimales para el XML/UBL (Estándar UBL 2.1 permite hasta 10)
UNIT_PRICE_NO_IGV_PAYLOAD_PRECISION = Decimal('0.0000000000') 
# 10 decimales para el cálculo base inicial
UNIT_PRICE_NO_IGV_CALC_PRECISION = Decimal('0.0000000000')    
TOTAL_PRECISION = Decimal('0.00')
TASA_IGV = Decimal('0.18')
FACTOR_IGV = Decimal('1.18')

# --- FUNCIONES AUXILIARES ---

def to_decimal(value: Any) -> Decimal:
    """Convierte un float, str o int a Decimal, manejando valores nulos o vacíos."""
    if value is None or value == '':
        return Decimal('0')
    try:
        # Normalizar string para asegurar que use '.' como separador decimal
        str_value = str(value).replace(',', '.')
        return Decimal(str_value).normalize()
    except Exception:
        print(f"WARN: No se pudo convertir '{value}' a Decimal. Usando 0.")
        return Decimal('0')

# --- LÓGICA DE CÁLCULO V3 (ESTRATEGIA INVERSA) ---

def get_line_totals_v3(
    cantidad_in: Any, 
    precio_unitario_con_igv_in: Any
) -> Dict[str, Decimal]:
    """
    Calcula los totales de una línea priorizando la consistencia:
    Cantidad * ValorUnitario = ValorVenta (validación SUNAT 3271).
    """
    
    cantidad_d = to_decimal(cantidad_in)
    precio_unitario_con_igv_d = to_decimal(precio_unitario_con_igv_in)

    if cantidad_d <= 0 or precio_unitario_con_igv_d < 0:
        return {
            'valor_unitario_sin_igv_payload': Decimal('0'),
            'valor_unitario_sin_igv_calculo': Decimal('0'),
            'mto_valor_venta_linea': Decimal('0'),
            'igv_linea': Decimal('0'),
            'precio_total_linea': Decimal('0'),
            'mto_precio_unitario_con_igv': Decimal('0'),
        }

    # 1. Calcular Valor Unitario SIN IGV Teórico (Alta precisión)
    valor_unitario_sin_igv_teorico = (precio_unitario_con_igv_d / FACTOR_IGV).quantize(
        UNIT_PRICE_NO_IGV_CALC_PRECISION, rounding=ROUND_HALF_UP
    )

    # 2. Calcular Valor de Venta de la línea (Base Imponible)
    #    Se usa el teórico * cantidad y se redondea a 2 decimales.
    #    Este es el "mtoValorVenta" definitivo que irá al XML.
    mto_valor_venta_linea_d = (cantidad_d * valor_unitario_sin_igv_teorico).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 3. ESTRATEGIA INVERSA: Recalcular el Valor Unitario para el Payload (XML)
    #    Para cumplir la validación 3271 (ValVenta = Cant * ValUnit),
    #    derivamos el Valor Unitario exacto dividiendo la Base Imponible redondeada entre la Cantidad.
    if cantidad_d > 0:
        valor_unitario_sin_igv_payload_d = (mto_valor_venta_linea_d / cantidad_d).quantize(
            UNIT_PRICE_NO_IGV_PAYLOAD_PRECISION, rounding=ROUND_HALF_UP
        )
    else:
        valor_unitario_sin_igv_payload_d = Decimal('0')

    # 4. Calcular IGV de la línea (Base * 0.18)
    igv_linea_d = (mto_valor_venta_linea_d * TASA_IGV).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 5. Calcular Precio Total de la línea (Base + IGV)
    precio_total_linea_d = (mto_valor_venta_linea_d + igv_linea_d).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 6. Calcular Precio Unitario CON IGV (mtoPrecioUnitario) para Referencia
    #    Se deriva del total / cantidad
    if cantidad_d > 0:
        mto_precio_unitario_con_igv_d = (precio_total_linea_d / cantidad_d).quantize(
            TOTAL_PRECISION, rounding=ROUND_HALF_UP
        )
    else:
        mto_precio_unitario_con_igv_d = Decimal('0.00')

    return {
        'valor_unitario_sin_igv_payload': valor_unitario_sin_igv_payload_d,
        'valor_unitario_sin_igv_calculo': valor_unitario_sin_igv_teorico, # Guardamos el teórico por si acaso
        'mto_valor_venta_linea': mto_valor_venta_linea_d,
        'igv_linea': igv_linea_d,
        'precio_total_linea': precio_total_linea_d,
        'mto_precio_unitario_con_igv': mto_precio_unitario_con_igv_d,
    }


def calculate_cotizacion_totals_v3(
    productos: List[Any] 
) -> Dict[str, Any]:
    """
    Calcula los totales V3 para una lista de productos.
    """
    
    total_gravado_acumulado_d = Decimal('0.00')
    total_igv_acumulado_d = Decimal('0.00')
    line_totals_list = []

    for prod in productos:
        cantidad_in = None
        precio_unitario_con_igv_in = None

        # Manejar objetos Pydantic o dicts
        if hasattr(prod, 'unidades') and hasattr(prod, 'precio_unitario'):
            cantidad_in = prod.unidades
            precio_unitario_con_igv_in = prod.precio_unitario
        elif isinstance(prod, dict):
            cantidad_in = prod.get('unidades')
            precio_unitario_con_igv_in = prod.get('precio_unitario')
        
        if cantidad_in is None or precio_unitario_con_igv_in is None:
            print(f"WARN: Item de producto inválido omitido: {prod}")
            line_totals_list.append(get_line_totals_v3(0, 0))
            continue

        line_totals = get_line_totals_v3(cantidad_in, precio_unitario_con_igv_in)
        line_totals_list.append(line_totals)
        
        total_gravado_acumulado_d += line_totals['mto_valor_venta_linea']
        total_igv_acumulado_d += line_totals['igv_linea']

    # Totales finales
    monto_total_v3 = (total_gravado_acumulado_d + total_igv_acumulado_d).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )
    total_gravado_v3 = total_gravado_acumulado_d.quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )
    total_igv_v3 = total_igv_acumulado_d.quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    return {
        'monto_total_v3': monto_total_v3,
        'total_gravado_v3': total_gravado_v3,
        'total_igv_v3': total_igv_v3,
        'line_totals': line_totals_list,
    }