//
//  SceneContainer.swift
//  angle-rfp
//
//  Full-screen scene container with transition support.
//

import SwiftUI

struct SceneContainer<Content: View>: View {
    let content: Content
    @State private var isVisible = false

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(DesignSystem.Palette.Background.base)
            .opacity(isVisible ? 1 : 0)
            .offset(y: isVisible ? 0 : 20)
            .onAppear {
                withAnimation(.easeOut(duration: 0.4)) {
                    isVisible = true
                }
            }
    }
}

#if DEBUG
struct SceneContainer_Previews: PreviewProvider {
    static var previews: some View {
        SceneContainer {
            Text("Scene Content")
                .foregroundColor(.white)
        }
    }
}
#endif
