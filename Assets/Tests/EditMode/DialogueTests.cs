using System.Collections;
using System.Linq;
using System.Reflection;
using KwGame.View;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.Tests
{
    public sealed class DialogueTests
    {
        const BindingFlags Private = BindingFlags.Instance | BindingFlags.NonPublic;
        GameObject game;
        GameController controller;
        Label label;
        TypeReveal type;
        PanelSettings panelSettings;

        [SetUp]
        public void Setup()
        {
            game = new GameObject("Dialogue test");
            controller = game.AddComponent<GameController>();
            Call("BuildUi");
            label = (Label)Get("dlgText");
            type = (TypeReveal)Get("dlgType");
            type.Speed = 1;
            panelSettings = ((UIDocument)Get("doc")).panelSettings;
        }

        [TearDown]
        public void Cleanup()
        {
            if (game != null) Object.DestroyImmediate(game);
            if (panelSettings != null) Object.DestroyImmediate(panelSettings);
        }

        [Test]
        public void FirstInputRevealsAndSameFrameInputCannotAdvance()
        {
            var wait = BeginLine("한 글자씩 나타나는 충분히 긴 대사입니다.");
            Assert.That(type.Typing, Is.True);
            Assert.That(type.Shown, Is.LessThan(type.Text.Length), "처음엔 일부만 보임");
            Call("RequestAdvance");
            Assert.That(type.Typing, Is.False);
            Assert.That(Enumerable.Range(0, type.Text.Length).All(i => type.Alpha(i) == 255), Is.True, "첫 입력 = 전부 표시");
            Assert.That(Ui.Plain(label.text), Is.EqualTo("한 글자씩 나타나는 충분히 긴 대사입니다."), "화면 글 = 대사 그대로 (자리는 처음부터 다 잡혀 있음)");
            Assert.That((bool)Get("clicked"), Is.False);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.False);
            Assert.That(wait.MoveNext(), Is.True);

            Set("advanceFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void RepeatedTextRestartsTheRevealAfterThePreviousLine()
        {
            var wait = BeginLine("동일한 대사도 다시 타이핑합니다.");
            Call("RequestAdvance");
            Set("advanceFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That(wait.MoveNext(), Is.False);
            BeginLine("동일한 대사도 다시 타이핑합니다.");
            Assert.That(type.Typing, Is.True);
            Assert.That(Enumerable.Range(0, type.Text.Length).Any(i => type.Alpha(i) == 0), Is.True);
        }

        [Test]
        public void CompletedDialogueNeedsOnlyOneInputToAdvance()
        {
            var wait = BeginLine("완료된 대사입니다.");
            Call("CompleteDialogueText");
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void ModalWaitStillAdvancesWithOneInput()
        {
            type.Start("이전 대사");
            var wait = (IEnumerator)Call("WaitClick", false);
            Assert.That(wait.MoveNext(), Is.True);
            Set("waitFrame", Time.frameCount - 1);
            Call("RequestAdvance");
            Assert.That((bool)Get("clicked"), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        [Test]
        public void AutoSkipCompletesTextWithoutWaitingForAnInput()
        {
            controller.autoSkipDialog = true;
            var wait = BeginLine("데모에서 모든 글자가 즉시 표시됩니다.");
            Assert.That(type.Typing, Is.False);
            Assert.That(Enumerable.Range(0, type.Text.Length).All(i => type.Alpha(i) == 255), Is.True);
            Assert.That(wait.MoveNext(), Is.False);
        }

        IEnumerator BeginLine(string text)
        {
            var say = (IEnumerator)Call("Say", "nar", null, text, null);
            Assert.That(say.MoveNext(), Is.True);
            var wait = (IEnumerator)say.Current;
            Assert.That(wait.MoveNext(), Is.True);
            Set("waitFrame", Time.frameCount - 1);
            return wait;
        }

        object Get(string name) => typeof(GameController).GetField(name, Private).GetValue(controller);
        void Set(string name, object value) => typeof(GameController).GetField(name, Private).SetValue(controller, value);
        object Call(string name, params object[] arguments) => typeof(GameController).GetMethod(name, Private).Invoke(controller, arguments);
    }
}
