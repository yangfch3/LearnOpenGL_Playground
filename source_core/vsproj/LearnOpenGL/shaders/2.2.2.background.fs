#version 330 core
// =============================================================================
// 天空盒片元着色器：直接显示 HDR 环境立方体贴图
// =============================================================================
out vec4 FragColor;
in vec3 WorldPos;   // 采样方向

uniform samplerCube environmentMap;

void main()
{		
    // 2.2.x 中 envCubemap 已生成 mipmap，这里显式采样 mip 0 保证清晰
    // （若在 cpp 中改绑 prefilterMap，把 0.0 改为 1~4 可查看各级 mip 的模糊效果）
    vec3 envColor = textureLod(environmentMap, WorldPos, 0.0).rgb;
    
    // 环境贴图是 HDR，需要与 PBR shader 一样做色调映射 + Gamma 校正
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0/2.2)); 
    
    FragColor = vec4(envColor, 1.0);
}
