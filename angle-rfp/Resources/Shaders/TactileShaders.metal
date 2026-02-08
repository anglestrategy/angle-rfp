#include <metal_stdlib>
using namespace metal;

static float hash21(float2 p) {
    p = fract(p * float2(123.34, 345.45));
    p += dot(p, p + 34.345);
    return fract(p.x * p.y);
}

[[ stitchable ]] half4 tactileGrain(float2 position, half4 color, float intensity, float time) {
    float noise = hash21((position * 0.85) + float2(time * 17.0, time * 9.0)) - 0.5;
    float grain = clamp(noise * intensity * 2.0, -0.18, 0.18);
    float3 blended = clamp(float3(color.rgb) + grain, 0.0, 1.0);
    return half4(half3(blended), color.a);
}

[[ stitchable ]] half4 glassCaustic(float2 position, half4 color, float strength, float time) {
    float sweep = sin((position.x * 0.014) - (time * 1.8));
    float shimmer = sin((position.y * 0.04) + (time * 2.3) + (position.x * 0.004));
    float ridge = smoothstep(0.55, 0.98, ((sweep * 0.6) + (shimmer * 0.4) + 1.0) * 0.5);
    float caustic = ridge * strength;

    float3 cool = float3(0.58, 0.82, 1.0) * caustic;
    float3 warm = float3(1.0, 0.55, 0.34) * (caustic * 0.7);
    float3 blended = clamp(float3(color.rgb) + cool + warm, 0.0, 1.0);
    return half4(half3(blended), color.a);
}

[[ stitchable ]] half4 analysisScanline(float2 position, half4 color, float strength, float speed, float time) {
    float line = 0.5 + (0.5 * sin(position.y * 0.85));
    float sweepY = fract((time * speed * 0.22) + (position.y * 0.0006));
    float sweep = smoothstep(0.82, 1.0, sweepY);
    float pulse = ((line * 0.12) + (sweep * 0.88)) * strength;

    float3 tint = float3(0.80, 0.88, 1.0) * pulse;
    float3 shaded = float3(color.rgb) * (0.90 + (line * 0.10));
    float3 blended = clamp(shaded + tint, 0.0, 1.0);
    return half4(half3(blended), color.a);
}
