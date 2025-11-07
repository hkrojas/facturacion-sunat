# backend/calculations.py
# ARCHIVO CORREGIDO (RUTA SIN /core/)
# Este archivo centraliza toda la lógica de cálculo de impuestos (V3)
# para ser reutilizada en crud.py, facturacion_service.py y pdf_generator.py.

from decimal import Decimal, ROUND_HALF_UP, getcontext
from typing import List, Union, Dict, Any
# import schemas # <-- ¡ELIMINADO! Esto causa la importación circular.

# Ajustar la precisión global para operaciones con Decimal
getcontext().prec = 50

# --- CONSTANTES DE CÁLCULO ---
UNIT_PRICE_NO_IGV_PAYLOAD_PRECISION = Decimal('0.0000000000')
UNIT_PRICE_NO_IGV_CALC_PRECISION = Decimal('0.00')
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

# --- LÓGICA DE CÁLCULO V3 ---

def get_line_totals_v3(
    cantidad_in: Any, 
    precio_unitario_con_igv_in: Any
) -> Dict[str, Decimal]:
    """
    Calcula los totales de una línea de producto usando la lógica V3 (SUNAT).
    Toma la cantidad y el precio unitario CON IGV.
    
    Devuelve un diccionario con:
    - 'valor_unitario_sin_igv_payload': Decimal (10 decimales)
    - 'valor_unitario_sin_igv_calculo': Decimal (2 decimales)
    - 'mto_valor_venta_linea': Decimal (Base Imponible de la línea, 2 decimales)
    - 'igv_linea': Decimal (IGV de la línea, 2 decimales)
    - 'precio_total_linea': Decimal (Total de la línea, 2 decimales)
    - 'mto_precio_unitario_con_igv': Decimal (PU con IGV recalculado, 2 decimales)
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

    # 1. Calcular Valor Unitario SIN IGV con alta precisión (para el payload UBL)
    valor_unitario_sin_igv_payload_d = (precio_unitario_con_igv_d / FACTOR_IGV).quantize(
        UNIT_PRICE_NO_IGV_PAYLOAD_PRECISION, rounding=ROUND_HALF_UP
    )

    # 2. Calcular Valor Unitario SIN IGV redondeado a 2 decimales (para el cálculo de la base)
    valor_unitario_sin_igv_calculo_d = (precio_unitario_con_igv_d / FACTOR_IGV).quantize(
        UNIT_PRICE_NO_IGV_CALC_PRECISION, rounding=ROUND_HALF_UP
    )

    # 3. Calcular Valor de Venta de la línea SIN IGV (mtoValorVenta / LineExtensionAmount)
    mto_valor_venta_linea_d = (cantidad_d * valor_unitario_sin_igv_calculo_d).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 4. Calcular IGV de la línea
    igv_linea_d = (mto_valor_venta_linea_d * TASA_IGV).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 5. Calcular Precio Total de la línea (Base + IGV)
    precio_total_linea_d = (mto_valor_venta_linea_d + igv_linea_d).quantize(
        TOTAL_PRECISION, rounding=ROUND_HALF_UP
    )

    # 6. Calcular Precio Unitario CON IGV (mtoPrecioUnitario) para el UBL/PDF
    #    Se deriva del total calculado V3 / cantidad
    if cantidad_d == Decimal('0'):
        mto_precio_unitario_con_igv_d = Decimal('0.00')
    else:
        mto_precio_unitario_con_igv_d = (precio_total_linea_d / cantidad_d).quantize(
            TOTAL_PRECISION, rounding=ROUND_HALF_UP
        )

    return {
        'valor_unitario_sin_igv_payload': valor_unitario_sin_igv_payload_d,
        'valor_unitario_sin_igv_calculo': valor_unitario_sin_igv_calculo_d,
        'mto_valor_venta_linea': mto_valor_venta_linea_d,
        'igv_linea': igv_linea_d,
        'precio_total_linea': precio_total_linea_d,
        'mto_precio_unitario_con_igv': mto_precio_unitario_con_igv_d,
    }


def calculate_cotizacion_totals_v3(
    # --- CORRECCIÓN CLAVE ---
    # Cambiamos el tipado para que no dependa de 'schemas'
    # La lógica interna ya maneja Pydantic (con .unidades) y dicts (con .get('unidades'))
    productos: List[Any] 
) -> Dict[str, Any]:
    """
    Calcula los totales V3 para una lista de productos (de Cotización o Factura Directa).
    
    Devuelve un diccionario con:
    - 'monto_total_v3': Decimal (Total general, 2 decimales)
    - 'total_gravado_v3': Decimal (Base imponible total, 2 decimales)
    - 'total_igv_v3': Decimal (IGV total, 2 decimales)
    - 'line_totals': Lista de diccionarios, cada uno siendo el resultado de get_line_totals_v3
    """
    
    total_gravado_acumulado_d = Decimal('0.00')
    total_igv_acumulado_d = Decimal('0.00')
    line_totals_list = []

    for prod in productos:
        cantidad_in = None
        precio_unitario_con_igv_in = None

        # Manejar tanto objetos Pydantic (tienen attr 'unidades')
        if hasattr(prod, 'unidades') and hasattr(prod, 'precio_unitario'):
            cantidad_in = prod.unidades
            precio_unitario_con_igv_in = prod.precio_unitario
        # Como diccionarios
        elif isinstance(prod, dict):
            cantidad_in = prod.get('unidades')
            precio_unitario_con_igv_in = prod.get('precio_unitario')
        
        # Si no se puede determinar la entrada, saltar (aunque la lógica de get_line_totals_v3 lo manejaría)
        if cantidad_in is None or precio_unitario_con_igv_in is None:
            print(f"WARN: Item de producto inválido omitido: {prod}")
            # Añadir un set de resultados "vacío" para mantener la correspondencia de listas
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